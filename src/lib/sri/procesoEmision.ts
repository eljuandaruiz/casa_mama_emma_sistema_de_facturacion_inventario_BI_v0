/**
 * ORQUESTADOR DE EMISIÓN — flujo completo de una factura electrónica:
 *
 *  1. Reservar secuencial (transacción atómica, sin huecos por concurrencia)
 *  2. Generar clave de acceso (módulo 11)
 *  3. Construir XML <factura> v1.1.0
 *  4. Firmar XAdES-BES con el certificado .p12
 *  5. Enviar al WS Recepción  -> RECIBIDA | DEVUELTA
 *  6. Consultar WS Autorización -> AUTORIZADO | NO AUTORIZADO | EN PROCESO
 *  7. Persistir estados, mensajes y XML firmado (se conserva 7 años)
 *
 * Si el SRI no responde (sin internet, caída), la factura queda FIRMADA /
 * ERROR_ENVIO y puede reintentarse luego: ese es justamente el espíritu
 * del "esquema offline" del SRI (emites primero, transmites después,
 * dentro de las 72 horas).
 */
import { prisma } from '@/lib/db';
import { EMISOR } from '@/lib/config';
import { round2 } from '@/lib/money';
import { generarClaveAcceso } from '@/lib/sri/claveAcceso';
import { construirFacturaXml, type FacturaXmlInput } from '@/lib/sri/facturaXml';
import { firmarComprobante } from '@/lib/sri/firmaXades';
import { enviarComprobante, consultarAutorizacion, type MensajeSri } from '@/lib/sri/soapClient';
import { calcularPrecio, type ModoPrecio } from '@/lib/pricing';
import { TIPO_IDENTIFICACION, CONSUMIDOR_FINAL_ID, tarifaPorCodigo } from '@/lib/sri/catalogos';
import { generarRide } from '@/lib/pdf/ride';
import { enviarFacturaPorEmail } from '@/lib/email';
import { LEYENDA_AIRBNB_ES, LEYENDA_AIRBNB_EN } from '@/lib/sri/leyendaAirbnb';

export interface SolicitudFactura {
  habitacionIds: number[]; // 1..n (espacio compartido 3-4 puede ir junto)
  modoPrecio: ModoPrecio;
  huespedes: number;
  noches: number;
  checkIn?: string; // ISO
  checkOut?: string;
  descuentoUsd?: number;
  precioManualUsd?: number;
  codigoIva: string; // "4" | "8" | "0"
  formaPago: '01' | '20';
  propina?: number;
  precioAirbnbPersona?: number; // modo AIRBNB (compat: precio por persona/noche)
  netoAirbnbUsd?: number; // modo AIRBNB: payout que llega al anfitrión → deriva el total
  totalAirbnbUsd?: number; // modo AIRBNB: total que pagó el turista → deriva el neto
  comisionAirbnb?: number; // modo AIRBNB (% retenido por la plataforma)
  viaAirbnb?: boolean; // venta originada en Airbnb (activa el disclaimer legal)
  cliente: {
    tipoIdentificacion: string; // 04 | 05 | 06 | 07
    identificacion: string;
    razonSocial: string;
    direccion?: string;
    email?: string;
    telefono?: string;
    nacionalidad?: string; // CRM: país del huésped
    genero?: string; // CRM interno OPCIONAL (no va al SRI): MASCULINO | FEMENINO | OTRO
  };
  extras?: { descripcion: string; valor: number }[]; // consumos adicionales
}

export interface ResultadoEmision {
  facturaId: string;
  numeroCompleto: string;
  claveAcceso: string;
  estadoSri: string;
  numeroAutorizacion?: string;
  mensajes: MensajeSri[];
  total: number;
}

/**
 * Reserva el siguiente secuencial de forma atómica para la serie dada.
 * Si la serie es nueva (el admin cambió el código de referencia), crea su
 * propio contador empezando en 1 — cada serie lleva su numeración.
 */
async function siguienteSecuencial(establecimiento: string, puntoEmision: string): Promise<number> {
  const s = await prisma.secuencial.upsert({
    where: {
      establecimiento_puntoEmision_tipoComprobante: {
        establecimiento,
        puntoEmision,
        tipoComprobante: '01',
      },
    },
    update: { ultimo: { increment: 1 } },
    create: { establecimiento, puntoEmision, tipoComprobante: '01', ultimo: 1 },
  });
  return s.ultimo;
}

export async function emitirFactura(sol: SolicitudFactura): Promise<ResultadoEmision> {
  // ---------- 0. Validaciones de negocio ----------
  const habitaciones = await prisma.habitacion.findMany({
    where: { id: { in: sol.habitacionIds }, activa: true },
  });
  if (habitaciones.length !== sol.habitacionIds.length) {
    throw new Error('Alguna habitación seleccionada no existe o está inactiva');
  }
  const config = await prisma.configuracion.findUniqueOrThrow({ where: { id: 1 } });
  // Código de referencia (serie): editable desde /ajustes; si está vacío usa .env.
  const estab = config.establecimiento || EMISOR.establecimiento;
  const punto = config.puntoEmision || EMISOR.puntoEmision;

  const esConsumidorFinal = sol.cliente.tipoIdentificacion === TIPO_IDENTIFICACION.CONSUMIDOR_FINAL;
  const identificacion = esConsumidorFinal ? CONSUMIDOR_FINAL_ID : sol.cliente.identificacion.trim();
  const razonSocial = esConsumidorFinal ? 'CONSUMIDOR FINAL' : sol.cliente.razonSocial.trim();

  // ---------- 1. Cálculo de valores ----------
  const calculo = calcularPrecio({
    habitaciones: habitaciones.map((h) => ({
      numero: h.numero,
      capacidad: h.capacidad,
      precioHabitacion: h.precioHabitacion,
      precioPersona: h.precioPersona,
    })),
    modo: sol.modoPrecio,
    huespedes: sol.huespedes,
    noches: sol.noches,
    descuentoUsd: sol.descuentoUsd,
    codigoIva: sol.codigoIva,
    precioManualUsd: sol.precioManualUsd,
    precioAirbnbPersona: sol.precioAirbnbPersona,
    netoAirbnbUsd: sol.netoAirbnbUsd,
    totalAirbnbUsd: sol.totalAirbnbUsd,
    comisionAirbnb: sol.comisionAirbnb,
  });

  const { tarifa } = tarifaPorCodigo(sol.codigoIva);

  // Detalles: una línea por habitación (o una sola para casa completa) + extras
  const lineas = calculo.detallePorHabitacion.map((d) => {
    const hab = habitaciones.find((h) => h.numero === d.numero);
    // numero 0 => línea agrupada de "Casa Completa" (no mapea a una habitación)
    const esCasaCompleta = d.numero === 0;
    return {
      habitacionId: hab?.id ?? null,
      codigoPrincipal: esCasaCompleta ? 'SERV-CASA' : `HAB-${String(d.numero).padStart(3, '0')}`,
      descripcion: d.descripcion,
      cantidad: 1,
      precioUnitario: d.valor,
      descuento: 0,
      precioTotalSinImpuesto: d.valor,
    };
  });
  for (const extra of sol.extras ?? []) {
    lineas.push({
      habitacionId: null,
      codigoPrincipal: 'SERV-EXTRA',
      descripcion: extra.descripcion,
      cantidad: 1,
      precioUnitario: round2(extra.valor),
      descuento: 0,
      precioTotalSinImpuesto: round2(extra.valor),
    });
  }

  // El descuento global se aplica a la primera línea (criterio SRI: el
  // descuento se refleja por detalle y en totalDescuento)
  if (calculo.descuento > 0 && lineas.length > 0) {
    lineas[0].descuento = calculo.descuento;
    lineas[0].precioTotalSinImpuesto = round2(lineas[0].precioUnitario - calculo.descuento);
  }

  const subtotalConExtras = round2(lineas.reduce((a, l) => a + l.precioTotalSinImpuesto, 0));
  const ivaConExtras = round2((subtotalConExtras * tarifa) / 100);
  const propina = round2(sol.propina ?? 0);
  const importeTotal = round2(subtotalConExtras + ivaConExtras + propina);

  // Regla SRI: consumidor final hasta el límite legal (USD 50 por defecto)
  if (esConsumidorFinal && importeTotal > EMISOR.limiteConsumidorFinal) {
    throw new Error(
      `Ventas sobre $${EMISOR.limiteConsumidorFinal} requieren identificar al cliente (no se permite CONSUMIDOR FINAL)`,
    );
  }

  // ---------- 2. Cliente (upsert) ----------
  // CRM de clientes recurrentes: si la identificación ya existe, se actualizan
  // sus datos (el huésped puede haber cambiado de email/teléfono); si no
  // existe, se crea. La próxima vez que este cliente facture, /api/clientes/
  // buscar lo encontrará y autocompletará el formulario al instante.
  const cliente = await prisma.cliente.upsert({
    where: { identificacion },
    update: {
      razonSocial,
      direccion: sol.cliente.direccion ?? undefined,
      email: sol.cliente.email ?? undefined,
      telefono: sol.cliente.telefono ?? undefined,
      nacionalidad: sol.cliente.nacionalidad ?? undefined,
    },
    create: {
      tipoIdentificacion: sol.cliente.tipoIdentificacion,
      identificacion,
      razonSocial,
      direccion: sol.cliente.direccion,
      email: sol.cliente.email,
      telefono: sol.cliente.telefono,
      nacionalidad: sol.cliente.nacionalidad,
    },
  });

  // ---------- 3. Secuencial + clave de acceso ----------
  const fechaEmision = new Date();
  const secuencial = await siguienteSecuencial(estab, punto);
  const numeroCompleto = `${estab}-${punto}-${String(secuencial).padStart(9, '0')}`;
  const claveAcceso = generarClaveAcceso({
    fechaEmision,
    tipoComprobante: '01',
    ruc: EMISOR.ruc,
    ambiente: EMISOR.ambiente,
    establecimiento: estab,
    puntoEmision: punto,
    secuencial,
  });

  // ---------- 4. XML ----------
  const bases = { '4': 0, '8': 0, '0': 0 } as Record<string, number>;
  bases[sol.codigoIva] = subtotalConExtras;

  const xmlInput: FacturaXmlInput = {
    ambiente: EMISOR.ambiente,
    razonSocial: EMISOR.razonSocial,
    nombreComercial: EMISOR.nombreComercial,
    ruc: EMISOR.ruc,
    claveAcceso,
    establecimiento: estab,
    puntoEmision: punto,
    secuencial,
    dirMatriz: config.dirMatriz,
    fechaEmision,
    dirEstablecimiento: config.dirEstablecimiento,
    obligadoContabilidad: config.obligadoContabilidad,
    tipoIdentificacionComprador: sol.cliente.tipoIdentificacion,
    razonSocialComprador: razonSocial,
    identificacionComprador: identificacion,
    direccionComprador: sol.cliente.direccion,
    totalSinImpuestos: subtotalConExtras,
    totalDescuento: calculo.descuento,
    totalImpuestos: [
      { codigoPorcentaje: sol.codigoIva, baseImponible: subtotalConExtras, valor: ivaConExtras },
    ],
    propina,
    importeTotal,
    formaPago: sol.formaPago,
    detalles: lineas.map((l) => ({
      codigoPrincipal: l.codigoPrincipal,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      descuento: l.descuento,
      precioTotalSinImpuesto: l.precioTotalSinImpuesto,
      codigoPorcentaje: sol.codigoIva,
      tarifa,
      valorIva: round2((l.precioTotalSinImpuesto * tarifa) / 100),
    })),
    camposAdicionales: [
      { nombre: 'Huespedes', valor: String(sol.huespedes) },
      { nombre: 'Noches', valor: String(sol.noches) },
      // Modo Airbnb: se deja constancia del cálculo (transparencia con el SRI
      // y con el turista: se factura el NETO recibido, no el precio de la
      // plataforma, del que Airbnb retiene su comisión).
      ...(calculo.airbnb
        ? [
            { nombre: 'Precio plataforma Airbnb', valor: `USD ${calculo.airbnb.precioPlataforma.toFixed(2)}` },
            { nombre: `Comision Airbnb (${calculo.airbnb.comisionPct}%)`, valor: `USD ${calculo.airbnb.comision.toFixed(2)}` },
            { nombre: 'Valor neto facturado', valor: `USD ${calculo.airbnb.netoRecibido.toFixed(2)}` },
          ]
        : []),
      ...(sol.cliente.email ? [{ nombre: 'Email', valor: sol.cliente.email }] : []),
      ...(sol.cliente.telefono ? [{ nombre: 'Telefono', valor: sol.cliente.telefono }] : []),
    ],
  };
  const xml = construirFacturaXml(xmlInput);

  // Nota / disclaimer para el RIDE:
  //  - Si la venta es "Vía Airbnb" (o se usó el modo de precio Airbnb), se
  //    inyecta el disclaimer legal EXACTO exigido, más el desglose numérico.
  const esAirbnb = sol.viaAirbnb || Boolean(calculo.airbnb);
  // Nota en ESPAÑOL + versión en INGLÉS con LOS MISMOS VALORES (se actualizan
  // solos porque salen del mismo cálculo). Ambas se imprimen en el RIDE.
  const notaAdicional = esAirbnb
    ? calculo.airbnb
      ? `${LEYENDA_AIRBNB_ES} Desglose: Precio en Airbnb: $${calculo.airbnb.precioPlataforma.toFixed(2)} / ` +
        `Comisión que toma Airbnb: ${calculo.airbnb.comisionPct}% / ` +
        `Neto facturado (obligación legal): $${calculo.airbnb.netoRecibido.toFixed(2)}.`
      : LEYENDA_AIRBNB_ES
    : null;
  const notaAdicionalEn = esAirbnb
    ? calculo.airbnb
      ? `${LEYENDA_AIRBNB_EN} Breakdown: Airbnb price: $${calculo.airbnb.precioPlataforma.toFixed(2)} / ` +
        `Airbnb commission: ${calculo.airbnb.comisionPct}% / ` +
        `Net invoiced (legal obligation): $${calculo.airbnb.netoRecibido.toFixed(2)}.`
      : LEYENDA_AIRBNB_EN
    : null;

  // ---------- 5. Persistir como GENERADA (antes de firmar/enviar) ----------
  const factura = await prisma.factura.create({
    data: {
      establecimiento: estab,
      puntoEmision: punto,
      secuencial,
      numeroCompleto,
      fechaEmision,
      ambiente: EMISOR.ambiente,
      claveAcceso,
      estadoSri: 'GENERADA',
      notaAdicional,
      notaAdicionalEn,
      clienteId: cliente.id,
      modoPrecio: sol.modoPrecio,
      huespedes: sol.huespedes,
      noches: sol.noches,
      checkIn: sol.checkIn ? new Date(sol.checkIn) : null,
      checkOut: sol.checkOut ? new Date(sol.checkOut) : null,
      subtotalSinImpuestos: subtotalConExtras,
      totalDescuento: calculo.descuento,
      base15: bases['4'],
      base8: bases['8'],
      base0: bases['0'],
      valorIva: ivaConExtras,
      propina,
      importeTotal,
      formaPago: sol.formaPago,
      detalles: {
        create: lineas.map((l) => ({
          habitacionId: l.habitacionId,
          codigoPrincipal: l.codigoPrincipal,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          descuento: l.descuento,
          precioTotalSinImpuesto: l.precioTotalSinImpuesto,
          codigoPorcentajeIva: sol.codigoIva,
          tarifaIva: tarifa,
          valorIva: round2((l.precioTotalSinImpuesto * tarifa) / 100),
        })),
      },
    },
  });

  // ---------- 5a-bis. Perfil demográfico interno (BI/CRM, NO va al SRI) ----------
  // Si el facturador indicó género y/o nacionalidad, se guarda el perfil de la
  // estadía de una vez (antes había que hacerlo a mano en /bi → Registrar).
  if (sol.cliente.genero || sol.cliente.nacionalidad) {
    try {
      await prisma.perfilHuesped.create({
        data: {
          facturaId: factura.id,
          genero: sol.cliente.genero ?? null,
          nacionalidad: sol.cliente.nacionalidad ?? null,
        },
      });
    } catch {
      // best-effort: el perfil interno nunca bloquea la emisión
    }
  }

  // ---------- 5b. Descontar consumibles del inventario (unit economics) ----------
  // Por cada habitación facturada, se descuentan sus consumibles estándar
  // (jabón, champú, papel…) del stock global y se acumula su COSTO monetario,
  // que luego permite calcular la utilidad bruta de la estadía.
  // Los consumibles con numeroHabitacion=0 aplican a cualquier habitación.
  // No aplica a modo CASA_COMPLETA con numero 0 (se toma por cada habitación real).
  try {
    const numerosFacturados = habitaciones.map((h) => h.numero);
    if (numerosFacturados.length > 0) {
      const consumibles = await prisma.consumibleHabitacion.findMany({
        where: { numeroHabitacion: { in: [...numerosFacturados, 0] } },
        include: { articulo: true },
      });
      let costoConsumibles = 0;
      for (const c of consumibles) {
        // Cuántas habitaciones facturadas activan este consumible.
        const vecesAplica = c.numeroHabitacion === 0
          ? numerosFacturados.length
          : numerosFacturados.filter((n) => n === c.numeroHabitacion).length;
        if (vecesAplica <= 0) continue;
        // Escalado por huéspedes (regla de la casa):
        //   POR_PERSONA -> 1 por huésped (agua, jabón, champú, jabón líquido)
        //   CADA_DOS    -> 1 hasta 2 personas, 2 con 3-4, etc. (papel higiénico)
        //   FIJO        -> cantidad fija por habitación facturada
        let cantidadTotal: number;
        if (c.regla === 'POR_PERSONA') {
          cantidadTotal = round2(c.cantidad * sol.huespedes);
        } else if (c.regla === 'CADA_DOS') {
          cantidadTotal = round2(c.cantidad * Math.ceil(sol.huespedes / 2));
        } else {
          cantidadTotal = round2(c.cantidad * vecesAplica);
        }
        if (cantidadTotal <= 0) continue;

        const nuevoStock = round2(c.articulo.stock - cantidadTotal);
        await prisma.articuloInventario.update({
          where: { id: c.articuloId },
          data: { stock: nuevoStock },
        });
        await prisma.movimientoInventario.create({
          data: {
            articuloId: c.articuloId,
            tipo: 'SALIDA',
            cantidad: cantidadTotal,
            motivo: `Consumo por factura ${numeroCompleto}`,
            stockResultante: nuevoStock,
          },
        });
        costoConsumibles += cantidadTotal * c.articulo.valorUnitario;
      }
      if (costoConsumibles > 0) {
        await prisma.factura.update({
          where: { id: factura.id },
          data: { costoConsumibles: round2(costoConsumibles) },
        });
      }
    }
  } catch {
    // El descuento de consumibles NO debe bloquear la emisión de la factura.
  }

  // ---------- 6. Firmar ----------
  let mensajes: MensajeSri[] = [];
  let estadoSri = 'GENERADA';
  let numeroAutorizacion: string | undefined;

  try {
    const xmlFirmado = firmarComprobante(xml, {
      p12Path: EMISOR.p12Path,
      password: EMISOR.p12Password,
    });
    estadoSri = 'FIRMADA';
    await prisma.factura.update({
      where: { id: factura.id },
      data: { estadoSri, xmlFirmado },
    });

    // ---------- 7. Enviar y autorizar ----------
    const recepcion = await enviarComprobante(xmlFirmado, EMISOR.ambiente);
    mensajes = recepcion.mensajes;

    if (recepcion.estado === 'RECIBIDA') {
      estadoSri = 'RECIBIDA';
      // El SRI tarda ~1-3 s en autorizar; se consulta con reintentos cortos
      for (let intento = 0; intento < 3; intento++) {
        await new Promise((r) => setTimeout(r, 1500));
        const auth = await consultarAutorizacion(claveAcceso, EMISOR.ambiente);
        if (auth.estado === 'AUTORIZADO') {
          estadoSri = 'AUTORIZADA';
          numeroAutorizacion = auth.numeroAutorizacion ?? claveAcceso;
          await prisma.factura.update({
            where: { id: factura.id },
            data: {
              estadoSri,
              numeroAutorizacion,
              fechaAutorizacion: auth.fechaAutorizacion ? new Date(auth.fechaAutorizacion) : new Date(),
              mensajesSri: JSON.stringify(auth.mensajes),
            },
          });
          // ---------- 8. Post-autorización: RIDE + email automático ----------
          // Genera el PDF y lo envía (con el XML) al email del cliente. Todo el
          // bloque es best-effort: un fallo aquí NO revierte la autorización.
          void entregarFacturaPorEmail(factura.id).catch(() => {});
          break;
        }
        if (auth.estado === 'NO AUTORIZADO') {
          estadoSri = 'NO_AUTORIZADA';
          mensajes = [...mensajes, ...auth.mensajes];
          break;
        }
        estadoSri = 'EN_PROCESO'; // seguirá consultable desde la lista de facturas
      }
    } else if (recepcion.estado === 'DEVUELTA') {
      estadoSri = 'DEVUELTA';
    } else {
      estadoSri = 'ERROR_ENVIO'; // sin conexión: reintentar luego (esquema offline, 72h)
    }
  } catch (e) {
    estadoSri = 'ERROR_FIRMA';
    mensajes = [...mensajes, { mensaje: (e as Error).message }];
  }

  await prisma.factura.update({
    where: { id: factura.id },
    data: { estadoSri, mensajesSri: JSON.stringify(mensajes) },
  });

  return {
    facturaId: factura.id,
    numeroCompleto,
    claveAcceso,
    estadoSri,
    numeroAutorizacion,
    mensajes,
    total: importeTotal,
  };
}

/**
 * Post-autorización: genera el RIDE (PDF) y envía por email al cliente el PDF y
 * el XML autorizado. Best-effort: si no hay email o SMTP, simplemente no envía.
 * Se llama al autorizar y también puede llamarse tras un reintento exitoso.
 */
export async function entregarFacturaPorEmail(facturaId: string): Promise<void> {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { detalles: true, cliente: true },
  });
  // Solo tiene sentido si está autorizada, tiene XML y el cliente tiene email.
  if (!factura || factura.estadoSri !== 'AUTORIZADA' || !factura.xmlFirmado) return;
  if (!factura.cliente.email) return;

  const config = await prisma.configuracion.findUniqueOrThrow({ where: { id: 1 } });
  const pdf = await generarRide(factura, {
    ruc: EMISOR.ruc,
    razonSocial: EMISOR.razonSocial,
    nombreComercial: EMISOR.nombreComercial,
    dirMatriz: config.dirMatriz,
    dirEstablecimiento: config.dirEstablecimiento,
    obligadoContabilidad: config.obligadoContabilidad,
    ambiente: factura.ambiente,
    leyenda: config.leyendaRide,
  });

  await enviarFacturaPorEmail({
    para: factura.cliente.email,
    numeroCompleto: factura.numeroCompleto,
    pdf,
    xml: factura.xmlFirmado,
  });
}

/** Reintenta envío/autorización de una factura pendiente (offline 72h). */
export async function reintentarEmision(facturaId: string): Promise<ResultadoEmision> {
  const f = await prisma.factura.findUniqueOrThrow({ where: { id: facturaId } });
  if (f.estadoSri === 'AUTORIZADA') {
    return {
      facturaId: f.id,
      numeroCompleto: f.numeroCompleto,
      claveAcceso: f.claveAcceso,
      estadoSri: f.estadoSri,
      numeroAutorizacion: f.numeroAutorizacion ?? undefined,
      mensajes: [],
      total: f.importeTotal,
    };
  }
  if (!f.xmlFirmado) throw new Error('La factura no tiene XML firmado; no se puede reenviar');

  let estadoSri = f.estadoSri;
  let mensajes: MensajeSri[] = [];
  let numeroAutorizacion: string | undefined;

  // Si nunca fue recibida, reenviar; si ya fue recibida, solo consultar
  if (estadoSri !== 'RECIBIDA' && estadoSri !== 'EN_PROCESO') {
    const recepcion = await enviarComprobante(f.xmlFirmado, f.ambiente as '1' | '2');
    mensajes = recepcion.mensajes;
    if (recepcion.estado === 'DEVUELTA') estadoSri = 'DEVUELTA';
    else if (recepcion.estado === 'RECIBIDA') estadoSri = 'RECIBIDA';
    else estadoSri = 'ERROR_ENVIO';
  }

  if (estadoSri === 'RECIBIDA' || estadoSri === 'EN_PROCESO') {
    const auth = await consultarAutorizacion(f.claveAcceso, f.ambiente as '1' | '2');
    mensajes = [...mensajes, ...auth.mensajes];
    if (auth.estado === 'AUTORIZADO') {
      estadoSri = 'AUTORIZADA';
      numeroAutorizacion = auth.numeroAutorizacion ?? f.claveAcceso;
      await prisma.factura.update({
        where: { id: f.id },
        data: {
          numeroAutorizacion,
          fechaAutorizacion: auth.fechaAutorizacion ? new Date(auth.fechaAutorizacion) : new Date(),
        },
      });
    } else if (auth.estado === 'NO AUTORIZADO') estadoSri = 'NO_AUTORIZADA';
    else estadoSri = 'EN_PROCESO';
  }

  await prisma.factura.update({
    where: { id: f.id },
    data: { estadoSri, mensajesSri: JSON.stringify(mensajes) },
  });

  // Si el reintento logró autorizar, entrega el PDF+XML por email (best-effort).
  if (estadoSri === 'AUTORIZADA') {
    void entregarFacturaPorEmail(f.id).catch(() => {});
  }

  return {
    facturaId: f.id,
    numeroCompleto: f.numeroCompleto,
    claveAcceso: f.claveAcceso,
    estadoSri,
    numeroAutorizacion,
    mensajes,
    total: f.importeTotal,
  };
}
