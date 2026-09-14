import { prisma } from '@/lib/db';
import { EMISOR } from '@/lib/config';
import { round2 } from '@/lib/money';
import { etiquetaArea } from '@/lib/areas';
import { calcularDepreciacion, categoriaCompra } from '@/lib/depreciacion';
import { feriadosDelAnio, temporadaDe, type NivelTemporada } from '@/lib/feriados';

/**
 * Exportación financiera "para IA": un Markdown compacto y autoexplicativo con
 * KPIs por mes, año y temporada (feriados de Ecuador) para pegarlo en un chat
 * de IA y obtener análisis. Los totales replican la lógica de /api/finanzas.
 */

export interface RangoExportacion {
  desde: Date;
  /** Exclusivo. */
  hasta: Date;
}

interface Mes {
  clave: string;
  ingresosBase: number;
  ingresosTotal: number;
  iva: number;
  nFacturas: number;
  nochesVendidas: number;
  huespedes: number;
  airbnb: number;
  directo: number;
  sinFactura: number;
  gastos: number;
  mantenimiento: number;
  compras: number;
  mejoras: number;
  nochesDisponibles: number;
}

interface Segmento {
  noches: number;
  ingreso: number;
}

const claveDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const claveMes = (d: Date) => claveDia(d).slice(0, 7);
const diasDelMes = (clave: string) => new Date(Number(clave.slice(0, 4)), Number(clave.slice(5, 7)), 0).getDate();
const usd = (n: number) => round2(n).toFixed(2);
const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : 'n/d');
const div = (num: number, den: number) => (den > 0 ? usd(num / den) : 'n/d');
const sumaMeses = (meses: Mes[], campo: keyof Mes) => meses.reduce((a, m) => a + (m[campo] as number), 0);

function tabla(cabecera: string[], filas: (string | number)[][]): string {
  if (!filas.length) return '_Sin datos en el rango._\n';
  const linea = (c: (string | number)[]) => `| ${c.join(' | ')} |`;
  return [linea(cabecera), linea(cabecera.map(() => '---')), ...filas.map(linea)].join('\n') + '\n';
}

function incrementar(mapa: Map<string, Segmento>, clave: string, noches: number, ingreso: number) {
  const s = mapa.get(clave) ?? { noches: 0, ingreso: 0 };
  s.noches += noches;
  s.ingreso += ingreso;
  mapa.set(clave, s);
}

export async function generarExportacionIA(rango: RangoExportacion, ahora = new Date()): Promise<string> {
  const { desde, hasta } = rango;
  const mesInicio = claveMes(desde);
  const mesFin = claveMes(new Date(hasta.getTime() - 1));

  const [habitaciones, facturas, anuladas, ingresosSimples, gastos, categorias, mantenimientos, compras, mejoras, reservas, obligaciones, servicios] =
    await Promise.all([
      prisma.habitacion.findMany({ orderBy: { numero: 'asc' } }),
      prisma.factura.findMany({
        where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false },
        include: { detalles: { select: { habitacionId: true, habitacion: { select: { numero: true } } } } },
      }),
      prisma.factura.count({ where: { fechaEmision: { gte: desde, lt: hasta }, anulada: true } }),
      prisma.ingresoSimple.findMany({ where: { fecha: { gte: desde, lt: hasta } } }),
      prisma.gasto.findMany({ where: { fecha: { gte: desde, lt: hasta } } }),
      prisma.categoriaGasto.findMany(),
      prisma.trabajoMantenimiento.findMany({ where: { fecha: { gte: desde, lt: hasta } } }),
      prisma.compra.findMany({ where: { fechaCompra: { gte: desde, lt: hasta } }, include: { proveedor: { select: { nombre: true } } } }),
      prisma.mejora.findMany({ where: { fecha: { gte: desde, lt: hasta } } }),
      prisma.reserva.findMany({ where: { checkIn: { gte: desde, lt: hasta } } }),
      prisma.obligacion.findMany({ where: { activa: true }, orderBy: { proximoVencimiento: 'asc' } }),
      prisma.servicioBasicoMes.findMany({ where: { mes: { gte: mesInicio, lte: mesFin } }, orderBy: { mes: 'asc' } }),
    ]);

  const habitacionesActivas = habitaciones.filter((h) => h.activa).length;
  const etiquetaGasto = new Map(categorias.map((c) => [c.valor, c.etiqueta]));

  // ---------- Meses del rango (desde el primer movimiento, incluyendo meses vacíos intermedios) ----------
  const primerMovimiento = Math.min(
    hasta.getTime() - 1,
    ...facturas.map((f) => f.fechaEmision.getTime()),
    ...ingresosSimples.map((i) => i.fecha.getTime()),
    ...gastos.map((g) => g.fecha.getTime()),
    ...mantenimientos.map((t) => t.fecha.getTime()),
    ...compras.map((c) => c.fechaCompra.getTime()),
    ...mejoras.map((j) => j.fecha.getTime()),
  );
  const inicioMeses = new Date(Math.max(desde.getTime(), primerMovimiento));
  const meses = new Map<string, Mes>();
  for (let d = new Date(inicioMeses.getFullYear(), inicioMeses.getMonth(), 1); d < hasta; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const clave = claveMes(d);
    meses.set(clave, {
      clave, ingresosBase: 0, ingresosTotal: 0, iva: 0, nFacturas: 0, nochesVendidas: 0, huespedes: 0,
      airbnb: 0, directo: 0, sinFactura: 0, gastos: 0, mantenimiento: 0, compras: 0, mejoras: 0,
      nochesDisponibles: habitacionesActivas * diasDelMes(clave),
    });
  }
  const mes = (fecha: Date): Mes | undefined => meses.get(claveMes(fecha));

  // ---------- Facturas: ingresos, noches y temporadas ----------
  const porNivel = new Map<string, Segmento>();
  const porEtiqueta = new Map<string, Segmento>();
  const porHabitacion = new Map<string, Segmento>();
  const porAnioCanal = new Map<string, Segmento>();
  let sinFechasEstadia = 0;
  const contarNivel = (anio: string, nivel: NivelTemporada, noches: number, ingreso: number) =>
    incrementar(porNivel, `${anio}|${nivel}`, noches, ingreso);

  for (const f of facturas) {
    const m = mes(f.fechaEmision);
    const habs = f.detalles.filter((d) => d.habitacionId !== null);
    const nHab = Math.max(1, habs.length);
    const noches = Math.max(1, f.noches);
    const nochesVendidas = nHab * noches;
    const airbnb = f.modoPrecio === 'AIRBNB' || /airbnb/i.test(f.notaAdicional ?? '');
    if (m) {
      m.ingresosBase += f.subtotalSinImpuestos;
      m.ingresosTotal += f.importeTotal;
      m.iva += f.valorIva;
      m.nFacturas += 1;
      m.nochesVendidas += nochesVendidas;
      m.huespedes += f.huespedes;
      if (airbnb) m.airbnb += f.subtotalSinImpuestos;
      else m.directo += f.subtotalSinImpuestos;
    }
    const anio = String(f.fechaEmision.getFullYear());
    incrementar(porAnioCanal, `${anio}|${airbnb ? 'Airbnb' : 'Directo'}`, nochesVendidas, f.subtotalSinImpuestos);
    for (const d of habs) {
      incrementar(porHabitacion, `${anio}|${d.habitacion?.numero ?? '?'}`, noches, f.subtotalSinImpuestos / nHab);
    }
    // Prorrateo por noche para clasificar por feriado/temporada.
    if (!f.checkIn) sinFechasEstadia += 1;
    const inicio = f.checkIn ?? f.fechaEmision;
    const ingresoPorNoche = f.subtotalSinImpuestos / noches;
    for (let n = 0; n < noches; n++) {
      const dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + n);
      const t = temporadaDe(claveDia(dia));
      contarNivel(anio, t.nivel, nHab, ingresoPorNoche);
      incrementar(porEtiqueta, `${anio}|${t.etiqueta}`, nHab, ingresoPorNoche);
    }
  }
  for (const i of ingresosSimples) {
    const m = mes(i.fecha);
    if (m) m.sinFactura += i.monto;
    incrementar(porAnioCanal, `${String(i.fecha.getFullYear())}|Sin factura (${i.canal})`, i.noches, i.monto);
  }

  // ---------- Egresos ----------
  const gastosPorCategoria = new Map<string, number>();
  for (const g of gastos) {
    const m = mes(g.fecha);
    if (m) m.gastos += g.subtotal;
    const k = `${g.fecha.getFullYear()}|${etiquetaGasto.get(g.categoria) ?? g.categoria}`;
    gastosPorCategoria.set(k, (gastosPorCategoria.get(k) ?? 0) + g.subtotal);
  }
  for (const t of mantenimientos) {
    const m = mes(t.fecha);
    if (m) m.mantenimiento += t.costoTotal;
  }
  for (const c of compras) {
    const m = mes(c.fechaCompra);
    if (m) m.compras += c.costo * c.cantidad;
  }
  for (const j of mejoras) {
    const m = mes(j.fecha);
    if (m) m.mejoras += j.costo;
  }

  const listaMeses = [...meses.values()];
  const anios = [...new Set(listaMeses.map((m) => m.clave.slice(0, 4)))];
  const resultado = (m: Mes) => m.ingresosBase - m.gastos - m.mantenimiento - m.compras;

  // ---------- Render ----------
  const s: string[] = [];
  s.push(`# ${EMISOR.nombreComercial} - Datos financieros para análisis con IA`);
  s.push('');
  s.push(`Generado: ${claveDia(ahora)}. Rango: ${claveDia(desde)} a ${claveDia(new Date(hasta.getTime() - 1))} (fechas en hora de Ecuador, UTC-5). Moneda: USD.`);
  s.push('');
  s.push('## Instrucciones para la IA (copiar junto con el resto del archivo)');
  s.push('');
  s.push('> Actúa como analista financiero y de revenue management para un hospedaje pequeño en Baños de Agua Santa, Ecuador. Con los datos de abajo entrega, en español sencillo y con cifras: 1) diagnóstico de la salud del negocio (ingresos, gastos, resultado, tendencia); 2) estacionalidad: qué meses, feriados y temporadas rinden más y peor, y la ocupación y tarifa media en cada uno; 3) propuesta de precios por temporada y por habitación; 4) gastos que se pueden recortar o negociar, comparando categorías y meses; 5) retorno de las mejoras e inversiones realizadas; 6) proyección de los próximos 3 meses considerando los feriados que vienen; 7) tres alertas o riesgos y tres acciones concretas para esta semana. Si un dato falta o es inconsistente, dilo en vez de suponerlo.');
  s.push('');
  s.push('## Contexto del negocio');
  s.push('');
  s.push(`- Nombre: ${EMISOR.nombreComercial} (${EMISOR.razonSocial}, RUC ${EMISOR.ruc}). Hospedaje familiar en Baños de Agua Santa, Tungurahua, Ecuador; clientes nacionales y extranjeros; ventas directas y vía Airbnb.`);
  s.push(`- Habitaciones activas: ${habitacionesActivas} (capacidad total ${habitaciones.filter((h) => h.activa).reduce((a, h) => a + h.capacidad, 0)} personas). Las habitaciones 3 y 4 comparten un mismo ambiente.`);
  s.push('- Impuestos: IVA sobre hospedaje (15% general, 8% en feriados declarados) y régimen RIMPE; las cifras "base" excluyen IVA.');
  s.push('- Airbnb: la factura registra el NETO recibido tras la comisión de la plataforma (aprox. 15,5%).');
  s.push('');
  s.push(tabla(
    ['Habitación', 'Capacidad', 'Camas', 'Tarifa por habitación/noche', 'Tarifa por persona/noche', 'Activa'],
    habitaciones.map((h) => [h.numero, h.capacidad, h.descripcionCamas, usd(h.precioHabitacion), usd(h.precioPersona), h.activa ? 'sí' : 'no']),
  ));
  s.push('## Diccionario de datos');
  s.push('');
  s.push('- Ingresos base: suma de facturas emitidas y no anuladas, sin IVA. Ingresos total: con IVA. Sin factura: cobros registrados como ingreso simple (neto recibido), no incluidos en "ingresos base".');
  s.push('- Noches vendidas: habitaciones facturadas x noches de la estadía. Noches disponibles: habitaciones activas x días del mes.');
  s.push('- Ocupación = noches vendidas / noches disponibles. ADR (tarifa media) = ingresos base / noches vendidas. RevPAR = ingresos base / noches disponibles. Estadía media = noches vendidas / facturas.');
  s.push('- Gastos: subtotal sin IVA de gastos operativos. Mantenimiento: costo total de trabajos. Compras: costo x cantidad (activos y consumibles). Mejoras: inversiones en áreas (no entran en el resultado operativo).');
  s.push('- Resultado operativo = ingresos base - gastos - mantenimiento - compras (misma fórmula que el panel de Finanzas).');
  s.push('- Temporada por noche: alta = feriados nacionales y sus puentes, Carnaval, Semana Santa y fin de año; media = fines de semana y vacaciones escolares (Sierra/Amazonía julio-agosto, Costa marzo-abril); baja = resto. Cada estadía se prorratea noche a noche.');
  s.push('');

  s.push('## Resumen por año');
  s.push('');
  s.push(tabla(
    ['Año', 'Ingresos base', 'Ingresos total', 'Sin factura', 'Facturas', 'Noches vendidas', 'Ocupación', 'ADR', 'RevPAR', 'Gastos', 'Mantenimiento', 'Compras', 'Mejoras', 'Resultado operativo'],
    anios.map((a) => {
      const ms = listaMeses.filter((m) => m.clave.startsWith(a));
      const base = sumaMeses(ms, 'ingresosBase');
      const noches = sumaMeses(ms, 'nochesVendidas');
      const disp = sumaMeses(ms, 'nochesDisponibles');
      return [a, usd(base), usd(sumaMeses(ms, 'ingresosTotal')), usd(sumaMeses(ms, 'sinFactura')), sumaMeses(ms, 'nFacturas'), noches, pct(noches, disp), div(base, noches), div(base, disp), usd(sumaMeses(ms, 'gastos')), usd(sumaMeses(ms, 'mantenimiento')), usd(sumaMeses(ms, 'compras')), usd(sumaMeses(ms, 'mejoras')), usd(ms.reduce((acc, m) => acc + resultado(m), 0))];
    }),
  ));

  s.push('## Mes a mes');
  s.push('');
  s.push(tabla(
    ['Mes', 'Ingresos base', 'Airbnb', 'Directo', 'Sin factura', 'Facturas', 'Huéspedes', 'Noches vendidas', 'Ocupación', 'ADR', 'Estadía media', 'Gastos', 'Mantenimiento', 'Compras', 'Mejoras', 'Resultado operativo'],
    listaMeses.map((m) => [m.clave, usd(m.ingresosBase), usd(m.airbnb), usd(m.directo), usd(m.sinFactura), m.nFacturas, m.huespedes, m.nochesVendidas, pct(m.nochesVendidas, m.nochesDisponibles), div(m.ingresosBase, m.nochesVendidas), m.nFacturas ? (m.nochesVendidas / m.nFacturas).toFixed(1) : 'n/d', usd(m.gastos), usd(m.mantenimiento), usd(m.compras), usd(m.mejoras), usd(resultado(m))]),
  ));

  s.push('## Canales de venta por año');
  s.push('');
  s.push(tabla(
    ['Año', 'Canal', 'Noches', 'Ingreso', 'Ingreso por noche'],
    [...porAnioCanal.entries()].sort().map(([k, v]) => [...k.split('|'), v.noches, usd(v.ingreso), div(v.ingreso, v.noches)]),
  ));

  s.push('## Rendimiento por habitación y año');
  s.push('');
  s.push(tabla(
    ['Año', 'Habitación', 'Noches vendidas', 'Ingreso base', 'Ingreso por noche'],
    [...porHabitacion.entries()].sort().map(([k, v]) => [...k.split('|'), v.noches, usd(v.ingreso), div(v.ingreso, v.noches)]),
  ));

  s.push('## Temporadas (noches prorrateadas)');
  s.push('');
  s.push(tabla(
    ['Año', 'Temporada', 'Noches vendidas', 'Ingreso base', 'ADR', '% del ingreso del año'],
    [...porNivel.entries()].sort().map(([k, v]) => {
      const anio = k.split('|')[0];
      const totalAnio = [...porNivel.entries()].filter(([kk]) => kk.startsWith(anio)).reduce((a, [, vv]) => a + vv.ingreso, 0);
      return [...k.split('|'), v.noches, usd(v.ingreso), div(v.ingreso, v.noches), pct(v.ingreso, totalAnio)];
    }),
  ));
  s.push('### Detalle por feriado y periodo');
  s.push('');
  s.push(tabla(
    ['Año', 'Periodo', 'Noches vendidas', 'Ingreso base', 'ADR'],
    [...porEtiqueta.entries()].sort((a, b) => a[0].slice(0, 4).localeCompare(b[0].slice(0, 4)) || b[1].ingreso - a[1].ingreso).map(([k, v]) => [...k.split('|'), v.noches, usd(v.ingreso), div(v.ingreso, v.noches)]),
  ));
  s.push('### Calendario de feriados nacionales (día observado)');
  s.push('');
  const aniosCalendario = [...new Set([...anios, String(ahora.getFullYear()), String(ahora.getFullYear() + 1)])].sort();
  for (const a of aniosCalendario) {
    s.push(`- ${a}: ${feriadosDelAnio(Number(a)).map((f) => `${f.fecha} ${f.nombre}`).join('; ')}`);
  }
  s.push('');

  s.push('## Gastos por categoría y año (sin IVA)');
  s.push('');
  s.push(tabla(
    ['Año', 'Categoría', 'Total'],
    [...gastosPorCategoria.entries()].sort((a, b) => a[0].slice(0, 4).localeCompare(b[0].slice(0, 4)) || b[1] - a[1]).map(([k, v]) => [...k.split('|'), usd(v)]),
  ));
  if (servicios.length) {
    s.push('### Servicios básicos registrados por mes (informativo, pueden estar también en gastos)');
    s.push('');
    s.push(tabla(['Mes', 'Servicio', 'Valor'], servicios.map((x) => [x.mes, x.tipo, usd(x.valor)])));
  }

  s.push('## Mantenimiento (trabajos de mayor costo)');
  s.push('');
  s.push(tabla(
    ['Fecha', 'Área', 'Tipo', 'Trabajo', 'Costo'],
    [...mantenimientos].sort((a, b) => b.costoTotal - a.costoTotal).slice(0, 15).map((t) => [claveDia(t.fecha), etiquetaArea(t.area), t.tipo, t.titulo, usd(t.costoTotal)]),
  ));

  s.push('## Compras, activos y depreciación');
  s.push('');
  const porCategoriaCompra = new Map<string, { costo: number; depAnual: number; enLibros: number; n: number }>();
  for (const c of compras) {
    const costo = c.costo * c.cantidad;
    const dep = calcularDepreciacion(costo, c.categoria, c.fechaCompra, ahora);
    const k = categoriaCompra(c.categoria).etiqueta;
    const acc = porCategoriaCompra.get(k) ?? { costo: 0, depAnual: 0, enLibros: 0, n: 0 };
    acc.costo += costo;
    acc.depAnual += dep.depreciacionAnual;
    acc.enLibros += dep.valorEnLibros;
    acc.n += 1;
    porCategoriaCompra.set(k, acc);
  }
  s.push(tabla(
    ['Categoría', 'Compras', 'Costo total', 'Depreciación anual', 'Valor en libros hoy'],
    [...porCategoriaCompra.entries()].sort((a, b) => b[1].costo - a[1].costo).map(([k, v]) => [k, v.n, usd(v.costo), usd(v.depAnual), usd(v.enLibros)]),
  ));
  s.push('### Compras de mayor valor');
  s.push('');
  s.push(tabla(
    ['Fecha', 'Descripción', 'Categoría', 'Área', 'Proveedor', 'Costo'],
    [...compras].sort((a, b) => b.costo * b.cantidad - a.costo * a.cantidad).slice(0, 15).map((c) => [claveDia(c.fechaCompra), c.descripcion, categoriaCompra(c.categoria).etiqueta, etiquetaArea(c.area), c.proveedor?.nombre ?? '-', usd(c.costo * c.cantidad)]),
  ));

  s.push('## Mejoras e inversiones por área');
  s.push('');
  const mejorasPorArea = new Map<string, number>();
  for (const j of mejoras) {
    const k = `${j.fecha.getFullYear()}|${etiquetaArea(j.area)}`;
    mejorasPorArea.set(k, (mejorasPorArea.get(k) ?? 0) + j.costo);
  }
  s.push(tabla(['Año', 'Área', 'Inversión'], [...mejorasPorArea.entries()].sort().map(([k, v]) => [...k.split('|'), usd(v)])));
  s.push('### Mejoras de mayor valor');
  s.push('');
  s.push(tabla(
    ['Fecha', 'Área', 'Mejora', 'Costo'],
    [...mejoras].sort((a, b) => b.costo - a.costo).slice(0, 15).map((j) => [claveDia(j.fecha), etiquetaArea(j.area), j.descripcion, usd(j.costo)]),
  ));

  if (reservas.length) {
    s.push('## Reservas importadas de plataformas (calendario)');
    s.push('');
    const porMes = new Map<string, { n: number; noches: number; huespedes: number }>();
    for (const r of reservas) {
      const k = `${claveMes(r.checkIn)}|${r.fuente}`;
      const acc = porMes.get(k) ?? { n: 0, noches: 0, huespedes: 0 };
      acc.n += 1;
      acc.noches += Math.max(1, Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 86_400_000));
      acc.huespedes += r.numHuespedes ?? 0;
      porMes.set(k, acc);
    }
    s.push(tabla(['Mes', 'Fuente', 'Reservas', 'Noches', 'Huéspedes'], [...porMes.entries()].sort().map(([k, v]) => [...k.split('|'), v.n, v.noches, v.huespedes])));
  }

  s.push('## Obligaciones tributarias y permisos activos');
  s.push('');
  s.push(tabla(
    ['Obligación', 'Entidad', 'Recurrencia', 'Próximo vencimiento', 'Último pago'],
    obligaciones.map((o) => [o.nombre, o.entidad ?? '-', o.recurrencia, claveDia(o.proximoVencimiento), o.ultimoPago ? claveDia(o.ultimoPago) : '-']),
  ));

  s.push('## Notas sobre la calidad de los datos');
  s.push('');
  s.push(`- Facturas anuladas excluidas en el rango: ${anuladas}.`);
  s.push(`- Facturas sin fechas de estadía (se usó la fecha de emisión para la temporada): ${sinFechasEstadia} de ${facturas.length}.`);
  s.push(`- Meses del rango sin ninguna factura: ${listaMeses.filter((m) => m.nFacturas === 0).map((m) => m.clave).join(', ') || 'ninguno'}.`);
  s.push('- Las noches disponibles usan el mes completo aunque el rango empiece o termine a mitad de mes.');
  s.push('- La proyección de impuestos del panel de Finanzas es una estimación y no se incluye aquí.');
  s.push('');
  return s.join('\n');
}
