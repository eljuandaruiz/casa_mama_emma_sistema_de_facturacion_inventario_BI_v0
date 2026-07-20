'use client';

/**
 * FORMULARIO DE FACTURACIÓN — implementa la LÓGICA DE PRECIOS CRÍTICA:
 * toggle "Precio por habitación" (tarifa plana) vs "Precio por persona"
 * (huéspedes × tarifa × noches), con recálculo automático en vivo usando
 * exactamente el mismo módulo de cálculo (src/lib/pricing.ts) que el
 * backend, de modo que el total que ve el cliente ES el que se factura.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calcularPrecio, type ModoPrecio, DESCRIPCION_CASA_COMPLETA } from '@/lib/pricing';
import { fmtUsd } from '@/lib/money';
import { TARIFAS_IVA, FORMAS_PAGO, validarIdentificacion, validarTelefono } from '@/lib/sri/catalogos';
import { BotonCompartir } from '@/components/BotonCompartir';
import { EscanerPasaporte } from '@/components/EscanerPasaporte';
import { NACIONALIDADES } from '@/lib/paises';

// Capacidad máxima de toda la propiedad (regla del negocio).
const LIMITE_HUESPEDES = 21;
// Umbral de anomalía: por encima se pide confirmación (evita errores de tipeo).
const UMBRAL_MONTO_ALTO = 3000;

interface HabitacionDto {
  id: number;
  numero: number;
  nombre: string;
  descripcionCamas: string;
  capacidad: number;
  precioHabitacion: number;
  precioPersona: number;
  grupoCompartido: string | null;
}

interface Props {
  habitacion: HabitacionDto;
  hermanas: HabitacionDto[]; // habitaciones del mismo espacio compartido (3-4)
  limiteConsumidorFinal: number;
  /**
   * Modo grupos/casa completa: si se pasa, se muestra un selector libre de
   * TODAS las habitaciones y se habilita el cobro "Casa Completa".
   * (Lo usa la vista /facturar/grupos; la vista por habitación no lo pasa.)
   */
  habitacionesDisponibles?: HabitacionDto[];
  permitirCasaCompleta?: boolean;
  /** Ids de habitaciones preseleccionadas (viene del selector del inicio). */
  seleccionInicial?: number[];
  /** Modo de cobro inicial (p. ej. CASA_COMPLETA desde el inicio). */
  modoInicial?: ModoPrecio;
  /** Precarga de datos del cliente (viene del portal de huéspedes). */
  clienteInicial?: {
    tipoId?: '05' | '04' | '06' | '08';
    identificacion?: string;
    nombre?: string;
    direccion?: string;
    email?: string;
    telefono?: string;
    nacionalidad?: string;
  };
}

// La habitación 3 y la 4 comparten espacio físico: se marcan/desmarcan juntas.
const ESPACIO_UNICO = [3, 4];

/** Línea de cargo adicional (incidentales / multas / servicios extra). */
interface ExtraUI {
  descripcion: string;
  valor: string; // texto para permitir edición fluida
}

interface ResultadoEmision {
  facturaId: string;
  numeroCompleto: string;
  claveAcceso: string;
  estadoSri: string;
  mensajes: { mensaje?: string; informacionAdicional?: string }[];
  total: number;
}

const Stepper = ({
  valor,
  min,
  onChange,
  etiqueta,
}: {
  valor: number;
  min: number;
  onChange: (v: number) => void;
  etiqueta: string;
}) => (
  <div>
    <span className="etiqueta">{etiqueta}</span>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, valor - 1))}
        className="btn-secundario w-12 text-xl"
        aria-label={`Disminuir ${etiqueta}`}
      >
        −
      </button>
      <span className="w-12 text-center text-lg font-bold">{valor}</span>
      <button
        type="button"
        onClick={() => onChange(valor + 1)}
        className="btn-secundario w-12 text-xl"
        aria-label={`Aumentar ${etiqueta}`}
      >
        +
      </button>
    </div>
  </div>
);

export function FormularioFactura({
  habitacion,
  hermanas,
  limiteConsumidorFinal,
  habitacionesDisponibles,
  permitirCasaCompleta = false,
  seleccionInicial,
  modoInicial,
  clienteInicial,
}: Props) {
  const router = useRouter();
  const hayClientePrecargado = Boolean(clienteInicial?.identificacion || clienteInicial?.nombre);

  const modoGrupos = Array.isArray(habitacionesDisponibles) && habitacionesDisponibles.length > 0;

  // ---------- Estado de la estadía ----------
  const [incluirHermanas, setIncluirHermanas] = useState<number[]>([]);
  // Selección libre (modo grupos): ids de habitaciones marcadas.
  // Prioriza la preselección del inicio; si no hay, la habitación ancla.
  const [seleccionLibre, setSeleccionLibre] = useState<number[]>(
    modoGrupos
      ? (seleccionInicial && seleccionInicial.length > 0 ? seleccionInicial : [habitacion.id])
      : [],
  );
  const [modo, setModo] = useState<ModoPrecio>(modoInicial ?? 'HABITACION');
  const [huespedes, setHuespedes] = useState(2);
  const [noches, setNoches] = useState(1);
  const [descuento, setDescuento] = useState(0);
  const [precioManual, setPrecioManual] = useState('');
  const [codigoIva, setCodigoIva] = useState('4');
  const [formaPago, setFormaPago] = useState<'01' | '20'>('01');
  // ---------- Modo Airbnb ----------
  // Cálculo BIDIRECCIONAL Airbnb: se escribe el total (lo que paga el turista)
  // O el neto (lo que llega al anfitrión) y el otro campo se deriva solo.
  // `anclaAirbnb` recuerda cuál escribió el usuario, para que al cambiar la
  // comisión se recalcule el derivado y no el que él digitó.
  const [totalAirbnb, setTotalAirbnb] = useState('');
  const [netoAirbnb, setNetoAirbnb] = useState('');
  const [anclaAirbnb, setAnclaAirbnb] = useState<'TOTAL' | 'NETO'>('NETO');
  const [comisionAirbnb, setComisionAirbnb] = useState('15.5');

  const derivarAirbnb = (origen: 'TOTAL' | 'NETO', valor: string, comisionStr: string) => {
    const c = Number(comisionStr);
    const v = Number(valor);
    if (!valor || Number.isNaN(v) || v <= 0 || Number.isNaN(c) || c >= 100) {
      if (origen === 'TOTAL') setNetoAirbnb('');
      else setTotalAirbnb('');
      return;
    }
    if (origen === 'TOTAL') setNetoAirbnb((v * (1 - c / 100)).toFixed(2));
    else setTotalAirbnb((v / (1 - c / 100)).toFixed(2));
  };
  const cambiarTotalAirbnb = (v: string) => {
    setTotalAirbnb(v);
    setAnclaAirbnb('TOTAL');
    derivarAirbnb('TOTAL', v, comisionAirbnb);
  };
  const cambiarNetoAirbnb = (v: string) => {
    setNetoAirbnb(v);
    setAnclaAirbnb('NETO');
    derivarAirbnb('NETO', v, comisionAirbnb);
  };
  const cambiarComisionAirbnb = (v: string) => {
    setComisionAirbnb(v);
    derivarAirbnb(anclaAirbnb, anclaAirbnb === 'TOTAL' ? totalAirbnb : netoAirbnb, v);
  };

  /**
   * Aplica un preset de GANANCIA NETA por persona/noche:
   *  - Modos directos: precio pactado = ganancia × huéspedes × noches
   *    (es la BASE sin IVA: el IVA se suma encima y tu ganancia queda intacta).
   *  - Modo Airbnb: neto a recibir = esa base + IVA (el payout incluye IVA);
   *    el total de plataforma se deriva solo con la comisión.
   */
  const aplicarPreset = (gananciaPorPersona: number) => {
    const base = gananciaPorPersona * huespedes * noches;
    if (modo === 'AIRBNB') {
      const tarifa = codigoIva === '4' ? 15 : codigoIva === '8' ? 8 : 0;
      cambiarNetoAirbnb((base * (1 + tarifa / 100)).toFixed(2));
    } else {
      setPrecioManual(base.toFixed(2));
    }
  };

  // ---------- Incidentales / cargos extra ----------
  const [extras, setExtras] = useState<ExtraUI[]>([]);
  // Catálogo de productos/servicios (para añadir extras con 1 clic).
  const [productosCatalogo, setProductosCatalogo] = useState<
    { id: number; descripcion: string; precioUnitario: number }[]
  >([]);
  useEffect(() => {
    void fetch('/api/productos')
      .then((r) => (r.ok ? r.json() : []))
      .then(setProductosCatalogo)
      .catch(() => {});
  }, []);

  // ---------- Estado del cliente (precargable desde el portal) ----------
  const [consumidorFinal, setConsumidorFinal] = useState(!hayClientePrecargado);
  // Facturación B2B a entidad extranjera (Airbnb/Booking): fuerza código 08.
  const [b2bInternacional, setB2bInternacional] = useState(false);
  const [tipoId, setTipoId] = useState<'05' | '04' | '06' | '08'>(clienteInicial?.tipoId ?? '05');
  const [identificacion, setIdentificacion] = useState(clienteInicial?.identificacion ?? '');
  const [nombre, setNombre] = useState(clienteInicial?.nombre ?? '');
  const [direccion, setDireccion] = useState(clienteInicial?.direccion ?? '');
  const [email, setEmail] = useState(clienteInicial?.email ?? '');
  const [telefono, setTelefono] = useState(clienteInicial?.telefono ?? '');
  const [nacionalidad, setNacionalidad] = useState(clienteInicial?.nacionalidad ?? ''); // CRM: país del huésped
  const [genero, setGenero] = useState(''); // CRM interno OPCIONAL (no va al SRI)

  // ---------- Presets de tarifa (ganancia neta por persona/noche) ----------
  const [presets, setPresets] = useState<{ id: number; nombre: string; gananciaPorPersona: number }[]>([]);
  useEffect(() => {
    void fetch('/api/tarifas').then((r) => (r.ok ? r.json() : [])).then(setPresets).catch(() => {});
  }, []);

  // ---------- Comprobante de transferencia (foto) ----------
  const [fotoTransferencia, setFotoTransferencia] = useState(''); // data-URL JPEG reducido

  /** Reduce la foto en el navegador (máx 1280px, JPEG 80%) para subirla liviana. */
  const leerFotoComprobante = (file: File | undefined) => {
    if (!file) return setFotoTransferencia('');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      setFotoTransferencia(canvas.toDataURL('image/jpeg', 0.8));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // ---------- Plataforma y fechas de reserva ----------
  // "Vía Airbnb" activa el disclaimer legal en el PDF (independiente del modo
  // de precio). Las fechas de reserva son la ESTADÍA (distintas de la emisión).
  const [viaAirbnb, setViaAirbnb] = useState(false);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  // ---------- Estado del envío y modales ----------
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<ResultadoEmision | null>(null);
  // Modal de verificación pre-emisión (resumen consolidado antes de firmar).
  const [mostrarVerificacion, setMostrarVerificacion] = useState(false);
  // Estado del lookup de cliente por identificación (autocompletar).
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  const habitacionesSeleccionadas = useMemo(() => {
    if (modoGrupos) {
      return (habitacionesDisponibles ?? []).filter((h) => seleccionLibre.includes(h.id));
    }
    return [habitacion, ...hermanas.filter((h) => incluirHermanas.includes(h.id))];
  }, [modoGrupos, habitacionesDisponibles, seleccionLibre, habitacion, hermanas, incluirHermanas]);

  // Marca/desmarca una habitación respetando que la 3 y la 4 van juntas.
  const toggleHabitacion = (id: number, marcar: boolean) => {
    const disp = habitacionesDisponibles ?? [];
    const hab = disp.find((h) => h.id === id);
    if (!hab) return;
    // Ids del espacio único al que pertenece (o solo ella).
    const idsGrupo = ESPACIO_UNICO.includes(hab.numero)
      ? disp.filter((h) => ESPACIO_UNICO.includes(h.numero)).map((h) => h.id)
      : [id];
    setSeleccionLibre((prev) =>
      marcar ? [...new Set([...prev, ...idsGrupo])] : prev.filter((x) => !idsGrupo.includes(x)),
    );
  };

  // Suma de extras válidos (para el total mostrado y el envío)
  const extrasValidos = useMemo(
    () =>
      extras
        .map((e) => ({ descripcion: e.descripcion.trim(), valor: Number(e.valor) }))
        .filter((e) => e.descripcion.length > 0 && e.valor > 0),
    [extras],
  );
  const totalExtras = useMemo(
    () => extrasValidos.reduce((a, e) => a + e.valor, 0),
    [extrasValidos],
  );

  // ---------- CÁLCULO AUTOMÁTICO EN VIVO ----------
  const calculo = useMemo(() => {
    if (habitacionesSeleccionadas.length === 0) return null;
    try {
      return calcularPrecio({
        habitaciones: habitacionesSeleccionadas.map((h) => ({
          numero: h.numero,
          capacidad: h.capacidad,
          precioHabitacion: h.precioHabitacion,
          precioPersona: h.precioPersona,
        })),
        modo,
        huespedes,
        noches,
        descuentoUsd: descuento || 0,
        codigoIva,
        precioManualUsd: precioManual ? Number(precioManual) : undefined,
        netoAirbnbUsd: anclaAirbnb === 'NETO' && netoAirbnb ? Number(netoAirbnb) : undefined,
        totalAirbnbUsd: anclaAirbnb === 'TOTAL' && totalAirbnb ? Number(totalAirbnb) : undefined,
        comisionAirbnb: comisionAirbnb ? Number(comisionAirbnb) : undefined,
      });
    } catch {
      return null;
    }
  }, [habitacionesSeleccionadas, modo, huespedes, noches, descuento, codigoIva, precioManual, netoAirbnb, totalAirbnb, anclaAirbnb, comisionAirbnb]);

  // El IVA de los extras usa la misma tarifa seleccionada; el total mostrado
  // suma base + IVA de hospedaje + (extras + su IVA).
  const ivaExtras = useMemo(
    () => (calculo ? (totalExtras * calculo.tarifaIva) / 100 : 0),
    [calculo, totalExtras],
  );
  const totalConExtras = (calculo?.total ?? 0) + totalExtras + ivaExtras;

  // ¿El total supera el límite legal de Consumidor Final? (independiente del check)
  const superaLimiteCF = totalConExtras > limiteConsumidorFinal;
  const excedeLimiteCF = consumidorFinal && superaLimiteCF;

  // Si el total supera el límite y estaba en Consumidor Final, se fuerza a
  // identificar (regla SRI): se desmarca automáticamente.
  useEffect(() => {
    if (superaLimiteCF && consumidorFinal) setConsumidorFinal(false);
  }, [superaLimiteCF, consumidorFinal]);

  // ---------- Cálculo de estadía a partir de las fechas ----------
  // Parámetros del hospedaje: entrada 14:00, salida 11:00.
  // Noches = número de "duermes"; Días = noches + 1 (días de calendario que
  // el huésped está presente, criterio hotelero común).
  const estadia = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    const inicio = new Date(`${checkIn}T14:00:00`); // check-in 2:00 PM
    const fin = new Date(`${checkOut}T11:00:00`); // check-out 11:00 AM
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;
    if (fin <= inicio) return null;
    // Noches por fechas de calendario (ignora las horas para el conteo de noches).
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const noches = Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
    return { noches, dias: noches + 1 };
  }, [checkIn, checkOut]);

  // Cuando hay estadía válida, sincroniza el nº de noches del cálculo de precio.
  useEffect(() => {
    if (estadia && estadia.noches >= 1 && estadia.noches !== noches) {
      setNoches(estadia.noches);
    }
  }, [estadia]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Aviso de ocupación (INFORMATIVO, no bloquea) ----------
  // Cruza la habitación + fechas elegidas contra el calendario de Airbnb/
  // holds/facturas. Es un aviso, no una validación dura: la propia reserva
  // ya importada de Airbnb puede coincidir con la que se está facturando.
  const [avisosOcupacion, setAvisosOcupacion] = useState<
    { habitacion: string; origen: string; etiqueta: string }[]
  >([]);
  useEffect(() => {
    let cancelado = false;
    if (!checkIn || !checkOut || habitacionesSeleccionadas.length === 0) {
      setAvisosOcupacion([]);
      return;
    }
    (async () => {
      const avisos: { habitacion: string; origen: string; etiqueta: string }[] = [];
      for (const h of habitacionesSeleccionadas) {
        try {
          const res = await fetch(
            `/api/ocupacion/disponibilidad?numeroHabitacion=${h.numero}&checkIn=${checkIn}&checkOut=${checkOut}`,
          );
          const json = await res.json();
          if (json.conflicto) {
            avisos.push({ habitacion: h.nombre, origen: json.conflicto.origen, etiqueta: json.conflicto.etiqueta });
          }
        } catch {
          // best-effort: si falla el chequeo, no se bloquea el formulario.
        }
      }
      if (!cancelado) setAvisosOcupacion(avisos);
    })();
    return () => {
      cancelado = true;
    };
  }, [checkIn, checkOut, habitacionesSeleccionadas]);

  // ---------- Validaciones en vivo con mensajes descriptivos ----------
  // Error de identificación (solo si no es consumidor final).
  const errorId = useMemo(() => {
    if (consumidorFinal) return '';
    const r = validarIdentificacion(tipoId, identificacion);
    return r.ok ? '' : r.error;
  }, [consumidorFinal, tipoId, identificacion]);

  // Error de teléfono (solo números).
  const errorTelefono = useMemo(() => {
    const r = validarTelefono(telefono);
    return r.ok ? '' : r.error;
  }, [telefono]);

  // ---------- Autocompletar cliente por identificación (huésped recurrente) ----------
  const buscarCliente = async () => {
    const id = identificacion.trim();
    if (!id) return;
    setBuscandoCliente(true);
    try {
      const c = await fetch(`/api/clientes/buscar?identificacion=${encodeURIComponent(id)}`).then((r) => r.json());
      if (c) {
        // Precarga los datos del cliente existente.
        setNombre(c.razonSocial ?? '');
        setDireccion(c.direccion ?? '');
        setEmail(c.email ?? '');
        setTelefono(c.telefono ?? '');
        setNacionalidad(c.nacionalidad ?? '');
        if (c.tipoIdentificacion === '04' || c.tipoIdentificacion === '05' || c.tipoIdentificacion === '06') {
          setTipoId(c.tipoIdentificacion);
        }
      }
    } finally {
      setBuscandoCliente(false);
    }
  };

  /** Rellena la dirección con el valor rápido "Baños de Agua Santa". */
  const usarDireccionBanos = () => setDireccion('Baños de Agua Santa');

  /**
   * Lanza el flujo de emisión: primero valida y comprueba los umbrales
   * (21 huéspedes, $3000). Si todo pasa, abre el MODAL DE VERIFICACIÓN.
   * La emisión real (emitir()) solo ocurre desde ese modal.
   */
  const revisarYVerificar = () => {
    setError('');
    if (!calculo) return setError('Revisa los datos: el cálculo no es válido.');
    if (!consumidorFinal && errorId) return setError(errorId);
    if (errorTelefono) return setError(errorTelefono);
    if (!consumidorFinal && !nombre.trim()) return setError('Ingresa el nombre / razón social del cliente.');

    // Umbral de 21 huéspedes: confirmación explícita.
    if (huespedes > LIMITE_HUESPEDES) {
      const ok = window.confirm(`¿Está seguro de que desea superar el límite de ${LIMITE_HUESPEDES} personas?`);
      if (!ok) return;
    }
    // Umbral de monto alto: confirmación explícita (anti "fat-finger").
    if (totalConExtras > UMBRAL_MONTO_ALTO) {
      const ok = window.confirm(
        `Alerta: El monto total (${fmtUsd(totalConExtras)}) excede los $${UMBRAL_MONTO_ALTO}. ` +
          `¿Confirma que los valores ingresados son correctos?`,
      );
      if (!ok) return;
    }
    // Todo validado: mostrar el resumen consolidado antes de emitir.
    setMostrarVerificacion(true);
  };

  const emitir = async () => {
    setError('');
    setEnviando(true);
    try {
      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habitacionIds: habitacionesSeleccionadas.map((h) => h.id),
          modoPrecio: modo,
          huespedes,
          noches,
          descuentoUsd: descuento || undefined,
          precioManualUsd: precioManual ? Number(precioManual) : undefined,
          netoAirbnbUsd: modo === 'AIRBNB' && anclaAirbnb === 'NETO' && netoAirbnb ? Number(netoAirbnb) : undefined,
          totalAirbnbUsd: modo === 'AIRBNB' && anclaAirbnb === 'TOTAL' && totalAirbnb ? Number(totalAirbnb) : undefined,
          comisionAirbnb: modo === 'AIRBNB' && comisionAirbnb ? Number(comisionAirbnb) : undefined,
          viaAirbnb: viaAirbnb || modo === 'AIRBNB',
          checkIn: checkIn || undefined,
          checkOut: checkOut || undefined,
          codigoIva,
          formaPago,
          extras: extrasValidos.length > 0 ? extrasValidos : undefined,
          cliente: consumidorFinal
            ? { tipoIdentificacion: '07', identificacion: '9999999999999', razonSocial: 'CONSUMIDOR FINAL' }
            : {
                tipoIdentificacion: tipoId,
                identificacion: identificacion.trim(),
                razonSocial: nombre.trim(),
                direccion: direccion.trim() || undefined,
                email: email.trim() || undefined,
                telefono: telefono.trim() || undefined,
                nacionalidad: nacionalidad.trim() || undefined,
                genero: genero || undefined,
              },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al emitir la factura');
      // Si el pago fue por transferencia y hay foto del comprobante, se sube
      // best-effort (no bloquea el éxito de la emisión).
      if (formaPago === '20' && fotoTransferencia && json.facturaId) {
        void fetch(`/api/facturas/${json.facturaId}/comprobante`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagenBase64: fotoTransferencia }),
        }).catch(() => {});
      }
      setMostrarVerificacion(false);
      setResultado(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  // ---------- Pantalla de éxito ----------
  if (resultado) {
    const autorizada = resultado.estadoSri === 'AUTORIZADA';
    return (
      <div className="mx-auto max-w-lg space-y-4 py-6">
        <div className="tarjeta p-6 text-center">
          <span className="text-5xl">{autorizada ? '✅' : '🕓'}</span>
          <h1 className="mt-3 text-xl font-bold">
            Factura {resultado.numeroCompleto}
          </h1>
          <p className={`mt-1 text-sm font-semibold ${autorizada ? 'text-brand-700' : 'text-amber-600'}`}>
            {autorizada ? 'AUTORIZADA POR EL SRI' : `Estado: ${resultado.estadoSri}`}
          </p>
          <p className="mt-2 text-2xl font-bold">{fmtUsd(resultado.total)}</p>
          <p className="mt-3 break-all rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500">
            Clave de acceso: {resultado.claveAcceso}
          </p>
          {resultado.mensajes?.length > 0 && (
            <ul className="mt-2 space-y-1 text-left text-xs text-amber-700">
              {resultado.mensajes.map((m, i) => (
                <li key={i}>
                  • {m.mensaje} {m.informacionAdicional ? `(${m.informacionAdicional})` : ''}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 grid gap-2">
            <a
              href={`/api/facturas/${resultado.facturaId}/pdf`}
              target="_blank"
              className="btn-primario block text-center"
            >
              Ver / Imprimir PDF (RIDE)
            </a>
            <a
              href={`/api/facturas/${resultado.facturaId}/ticket`}
              target="_blank"
              className="btn-secundario block text-center"
            >
              🧾 Comprobante térmico (ticket)
            </a>
            <BotonCompartir
              url={`/api/facturas/${resultado.facturaId}/pdf`}
              nombreSugerido={`factura-${resultado.numeroCompleto}.pdf`}
              titulo={`Factura ${resultado.numeroCompleto} · Casa Mamá Emma`}
              className="btn-secundario block w-full text-center"
            />
            <button onClick={() => router.push('/')} className="btn-secundario">
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-8">
      <header className="flex items-center gap-3">
        <Link href="/" className="btn-secundario px-3 py-2 text-sm" aria-label="Volver">
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold md:text-2xl">
            {modoGrupos ? 'Facturar grupo / casa completa' : `Facturar · ${habitacion.nombre}`}
          </h1>
          <p className="text-xs text-slate-500">
            {modoGrupos
              ? 'Selecciona las habitaciones a incluir en una sola factura'
              : habitacion.descripcionCamas}
          </p>
        </div>
      </header>

      {/* ---------- Selección libre de habitaciones (modo grupos) ---------- */}
      {modoGrupos && (
        <section className="tarjeta p-4 md:p-5">
          <p className="etiqueta">Habitaciones incluidas</p>
          <div className="mt-2 grid grid-cols-1 gap-2 xs:grid-cols-2">
            {(habitacionesDisponibles ?? []).map((h) => {
              const marcada = seleccionLibre.includes(h.id);
              return (
                <label
                  key={h.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
                    marcada ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 accent-brand-600"
                    checked={marcada}
                    onChange={(e) => toggleHabitacion(h.id, e.target.checked)}
                  />
                  <span>
                    <span className="font-semibold">{h.nombre}</span>
                    <span className="block text-[11px] text-slate-500">
                      {h.descripcionCamas} · 👥 {h.capacidad}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {seleccionLibre.length} habitación(es) · capacidad total{' '}
            {(habitacionesDisponibles ?? [])
              .filter((h) => seleccionLibre.includes(h.id))
              .reduce((a, h) => a + h.capacidad, 0)}{' '}
            personas
          </p>
        </section>
      )}

      {/* ---------- Espacio compartido 3-4 (solo vista por habitación) ---------- */}
      {!modoGrupos && hermanas.length > 0 && (
        <section className="tarjeta border-sri-blue/20 bg-sri-light/50 p-4">
          <p className="text-sm font-semibold text-sri-blue">Espacio compartido</p>
          {hermanas.map((h) => (
            <label key={h.id} className="mt-2 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand-600"
                checked={incluirHermanas.includes(h.id)}
                onChange={(e) =>
                  setIncluirHermanas((prev) =>
                    e.target.checked ? [...prev, h.id] : prev.filter((x) => x !== h.id),
                  )
                }
              />
              Incluir {h.nombre} en la misma factura ({h.descripcionCamas})
            </label>
          ))}
        </section>
      )}

      {/* ================= BLOQUE: MÉTODO DE COBRO (acento ámbar) ================= */}
      {/* Jerarquía visual: cada bloque de datos tiene un color de borde distinto
          para que el facturador identifique la sección de un vistazo. */}
      <section className="tarjeta border-l-4 border-amber-400 p-4 md:p-5">
        {/* --- Plataforma: Vía Airbnb vs Directo --- */}
        <p className="etiqueta">Plataforma</p>
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="radiogroup">
          {(
            [
              { valor: false, titulo: 'Directo', sub: 'Fuera de Airbnb' },
              { valor: true, titulo: 'Vía Airbnb', sub: 'Con comisión 15.5%' },
            ] as const
          ).map((op) => (
            <button
              key={String(op.valor)}
              type="button"
              role="radio"
              aria-checked={viaAirbnb === op.valor}
              onClick={() => {
                setViaAirbnb(op.valor);
                // "Vía Airbnb" sugiere el modo de precio Airbnb automáticamente.
                if (op.valor && modo !== 'AIRBNB') setModo('AIRBNB');
                if (!op.valor && modo === 'AIRBNB') setModo('HABITACION');
              }}
              // "Vía Airbnb" activo usa el ROJO oficial de Airbnb (#FF5A5F)
              // para identificar el canal de un vistazo.
              className={`rounded-lg px-2 py-2.5 text-sm font-semibold transition ${
                viaAirbnb === op.valor
                  ? op.valor
                    ? 'text-white shadow'
                    : 'bg-white text-emerald-700 shadow'
                  : 'text-slate-500'
              }`}
              style={viaAirbnb === op.valor && op.valor ? { backgroundColor: '#FF5A5F' } : undefined}
            >
              {op.titulo}
              <span className="block text-[10px] font-normal">{op.sub}</span>
            </button>
          ))}
        </div>

        <p className="etiqueta">Tipo de tarifa</p>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="radiogroup">
          {(
            [
              { valor: 'HABITACION', titulo: 'Por habitación', sub: 'Tarifa plana / noche' },
              { valor: 'PERSONA', titulo: 'Por persona', sub: 'Huéspedes × noche' },
              { valor: 'AIRBNB', titulo: 'Airbnb', sub: 'Neto tras comisión' },
              ...(permitirCasaCompleta
                ? [{ valor: 'CASA_COMPLETA', titulo: 'Casa completa', sub: 'Toda la propiedad' } as const]
                : []),
            ] as const
          ).map((op) => (
            <button
              key={op.valor}
              type="button"
              role="radio"
              aria-checked={modo === op.valor}
              onClick={() => {
                setModo(op.valor);
                // Casa completa: incluir todas las habitaciones disponibles
                if (op.valor === 'CASA_COMPLETA' && habitacionesDisponibles) {
                  setSeleccionLibre(habitacionesDisponibles.map((h) => h.id));
                }
              }}
              // Cada modo con su color: habitación teal, persona azul,
              // Airbnb rojo oficial (#FF5A5F), casa completa violeta.
              className={`rounded-lg px-2 py-2.5 text-sm font-semibold transition ${
                modo === op.valor
                  ? op.valor === 'AIRBNB'
                    ? 'text-white shadow'
                    : op.valor === 'PERSONA'
                      ? 'bg-white text-blue-700 shadow'
                      : op.valor === 'CASA_COMPLETA'
                        ? 'bg-white text-violet-700 shadow'
                        : 'bg-white text-brand-700 shadow'
                  : 'text-slate-500'
              }`}
              style={modo === op.valor && op.valor === 'AIRBNB' ? { backgroundColor: '#FF5A5F' } : undefined}
            >
              {op.titulo}
              <span className="block text-[10px] font-normal">{op.sub}</span>
            </button>
          ))}
        </div>

        {/* --- Presets de tarifa: ganancia NETA por persona/noche ("$11 normal, $15 feriado…").
            Al tocar uno se calcula el precio según el modo activo: en modos directos fija
            el precio pactado (base sin IVA = tu ganancia); en Airbnb fija el NETO a recibir
            (ganancia + IVA incluido). Editables en /ajustes. --- */}
        {presets.length > 0 && (
          <div className="mt-3">
            <p className="etiqueta">Ganancia objetivo (por persona/noche)</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => aplicarPreset(p.gananciaPorPersona)}
                  className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                >
                  {p.nombre} · ${p.gananciaPorPersona}/p
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Calcula el precio automáticamente para {huespedes} huésped(es) × {noches} noche(s) en el modo activo.
            </p>
          </div>
        )}

        {modo === 'CASA_COMPLETA' && (
          <p className="mt-2 rounded-lg bg-sri-light/50 p-2 text-xs text-sri-blue">
            🏠 Se facturará como “{DESCRIPCION_CASA_COMPLETA}” en una sola línea, agrupando
            todas las habitaciones y el total de huéspedes.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Stepper etiqueta="Huéspedes" valor={huespedes} min={1} onChange={setHuespedes} />
          <Stepper etiqueta="Noches" valor={noches} min={1} onChange={setNoches} />
        </div>

        {/* Fechas de la ESTADÍA (reserva) — distintas de la fecha de emisión. */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="etiqueta" htmlFor="checkin">Check-in (reserva)</label>
            <input id="checkin" type="date" className="campo" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="checkout">Check-out (reserva)</label>
            <input id="checkout" type="date" className="campo" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
        </div>

        {/* Aviso de ocupación (informativo): la habitación ya tiene un bloque en el calendario para estas fechas. */}
        {avisosOcupacion.length > 0 && (
          <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            ⚠️ Ojo: {avisosOcupacion.map((a) => `${a.habitacion} ya tiene ${a.origen === 'AIRBNB' ? 'una reserva de Airbnb' : a.origen === 'FACTURA' ? 'una factura' : 'un hold'} (${a.etiqueta}) en estas fechas`).join('; ')}. Verifica que no sea overbooking.
          </div>
        )}

        {/* Cálculo automático de noches y días (entrada 14:00 / salida 11:00). */}
        {estadia && (
          <p className="mt-2 rounded-lg bg-sri-light/50 p-2 text-xs text-sri-blue">
            🗓️ {estadia.noches} noche(s) · {estadia.dias} día(s) · entrada 2:00 PM, salida 11:00 AM
          </p>
        )}

        {/* Descuento por estancia larga (política de Airbnb del negocio):
            7+ noches → 10%, 30+ noches → 30%. Solo se SUGIERE — se aplica
            únicamente si el facturador toca el botón. */}
        {noches >= 7 && descuento === 0 && calculo && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
            <span>
              💡 Estancia de {noches} noches: en Airbnb aplicas {noches >= 30 ? '30%' : '10%'} de descuento
              (−{fmtUsd(Math.round(calculo.subtotal * (noches >= 30 ? 30 : 10)) / 100)}).
            </span>
            <button
              type="button"
              className="rounded-full bg-emerald-600 px-3 py-1 font-semibold text-white"
              onClick={() => setDescuento(Math.round(calculo.subtotal * (noches >= 30 ? 30 : 10)) / 100)}
            >
              Aplicar descuento
            </button>
          </div>
        )}

        {huespedes > LIMITE_HUESPEDES && (
          <p className="mt-3 rounded-lg bg-coral-50 p-2 text-xs font-medium text-coral-700">
            ⚠️ Estás sobre el límite de {LIMITE_HUESPEDES} personas de la propiedad. Se pedirá
            confirmación al emitir.
          </p>
        )}

        {calculo?.excedeCapacidad && (
          <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            ⚠️ {huespedes} huéspedes superan la capacidad ({calculo.capacidadTotal}). Considera
            incluir otra habitación.
          </p>
        )}

        {/* ---------- Inputs del modo AIRBNB (bidireccional) ---------- */}
        {modo === 'AIRBNB' && (
          <div className="mt-4 rounded-xl border border-coral-200 bg-coral-50/40 p-3">
            <p className="text-xs font-semibold text-coral-700">
              Escribe UNO de los dos montos — el otro se calcula solo
            </p>
            <div className="mt-2 grid grid-cols-1 gap-3 xs:grid-cols-3">
              <div>
                <label className="etiqueta" htmlFor="netoAirbnb">
                  Neto que recibes (USD)
                  {anclaAirbnb === 'NETO' && netoAirbnb && <span className="ml-1 text-coral-600">●</span>}
                </label>
                <input
                  id="netoAirbnb"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  className="campo"
                  placeholder="Lo que te llega de Airbnb"
                  value={netoAirbnb}
                  onChange={(e) => cambiarNetoAirbnb(e.target.value)}
                />
              </div>
              <div>
                <label className="etiqueta" htmlFor="totalAirbnb">
                  Total en Airbnb (USD)
                  {anclaAirbnb === 'TOTAL' && totalAirbnb && <span className="ml-1 text-coral-600">●</span>}
                </label>
                <input
                  id="totalAirbnb"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  className="campo"
                  placeholder="Lo que paga el turista"
                  value={totalAirbnb}
                  onChange={(e) => cambiarTotalAirbnb(e.target.value)}
                />
              </div>
              <div>
                <label className="etiqueta" htmlFor="comision">Comisión Airbnb (%)</label>
                <input
                  id="comision"
                  type="number"
                  min={0}
                  max={99}
                  step="0.1"
                  inputMode="decimal"
                  className="campo"
                  value={comisionAirbnb}
                  onChange={(e) => cambiarComisionAirbnb(e.target.value)}
                />
              </div>
            </div>
            {calculo?.airbnb && (
              <div className="mt-3 space-y-0.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Precio plataforma (paga el turista)</span>
                  <span>{fmtUsd(calculo.airbnb.precioPlataforma)}</span>
                </div>
                <div className="flex justify-between text-coral-600">
                  <span>− Comisión Airbnb ({calculo.airbnb.comisionPct}%)</span>
                  <span>−{fmtUsd(calculo.airbnb.comision)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>= Neto que recibes (se factura)</span>
                  <span>{fmtUsd(calculo.airbnb.netoRecibido)}</span>
                </div>
              </div>
            )}
            <p className="mt-2 text-[10px] text-slate-500">
              El punto ● marca el monto que escribiste; el otro se deriva con la comisión.
              Se factura el NETO que te llega (IVA incluido); el desglose y la explicación
              (en español e inglés) salen impresos en la factura.
            </p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="etiqueta" htmlFor="descuento">Descuento (USD)</label>
            <input
              id="descuento"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="campo"
              value={descuento || ''}
              placeholder="0.00"
              onChange={(e) => setDescuento(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="manual">Precio pactado (opcional)</label>
            <input
              id="manual"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="campo"
              value={precioManual}
              placeholder="Auto"
              onChange={(e) => setPrecioManual(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xs:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="iva">Tarifa IVA</label>
            <select id="iva" className="campo" value={codigoIva} onChange={(e) => setCodigoIva(e.target.value)}>
              {TARIFAS_IVA.map((t) => (
                <option key={t.codigoPorcentaje} value={t.codigoPorcentaje}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="pago">Forma de pago</label>
            <select
              id="pago"
              className="campo"
              value={formaPago}
              onChange={(e) => setFormaPago(e.target.value as '01' | '20')}
            >
              {FORMAS_PAGO.map((f) => (
                <option key={f.codigo} value={f.codigo}>
                  {f.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pago por TRANSFERENCIA: quien factura fotografía el comprobante y
            lo sube; el administrador lo revisa después desde Facturas. */}
        {formaPago === '20' && (
          <div className="mt-3 rounded-xl border border-sri-blue/30 bg-sri-light/40 p-3">
            <label className="etiqueta">Foto del comprobante de transferencia</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              onChange={(e) => leerFotoComprobante(e.target.files?.[0])}
            />
            {fotoTransferencia ? (
              <p className="mt-1 text-xs text-emerald-700">✓ Foto lista: se subirá junto con la factura.</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Toma la foto de la pantalla/papeleta de la transferencia.</p>
            )}
          </div>
        )}
      </section>

      {/* ================= BLOQUE: DATOS DEL CLIENTE (acento azul) ================= */}
      <section className="tarjeta border-l-4 border-sri-blue p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Cliente</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {/* Consumidor Final: se DESHABILITA si el total supera el límite legal. */}
            <label className={`flex items-center gap-2 ${superaLimiteCF ? 'opacity-40' : ''}`}>
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand-600"
                checked={consumidorFinal}
                disabled={superaLimiteCF || b2bInternacional}
                onChange={(e) => setConsumidorFinal(e.target.checked)}
              />
              Consumidor Final
            </label>
            {/* B2B internacional: factura a Airbnb/Booking con código 08. */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand-600"
                checked={b2bInternacional}
                onChange={(e) => {
                  const on = e.target.checked;
                  setB2bInternacional(on);
                  if (on) {
                    setConsumidorFinal(false);
                    setTipoId('08');
                  }
                }}
              />
              Empresa extranjera (Airbnb/Booking)
            </label>
          </div>
        </div>

        {/* Preset 1-clic para facturar directamente a Airbnb (entidad contratante
            para anfitriones fuera de EE. UU.: Airbnb Ireland UC). El SRI acepta
            el nº fiscal extranjero (VAT irlandés) bajo el tipo 08. */}
        {b2bInternacional && (
          <button
            type="button"
            className="btn-secundario mt-2 text-xs"
            onClick={() => {
              setTipoId('08');
              setIdentificacion('IE9827384L');
              setNombre('AIRBNB IRELAND UNLIMITED COMPANY');
              setDireccion('8 Hanover Quay, Dublin 2, Irlanda');
            }}
          >
            Rellenar datos de Airbnb Ireland (VAT IE9827384L)
          </button>
        )}

        {superaLimiteCF && (
          <p className="mt-2 rounded-lg bg-coral-50 p-2 text-xs font-medium text-coral-600">
            ⚠️ El total supera ${limiteConsumidorFinal}: el SRI exige identificar al cliente.
            Elige Pasaporte (06) o Identificación del Exterior (08).
          </p>
        )}

        {!consumidorFinal && (
          <div className="mt-4 space-y-3">
            {/* Escáner MRZ: solo para pasaporte (06). Autocompleta nombre e ID. */}
            {tipoId === '06' && (
              <EscanerPasaporte
                onDatos={(m) => {
                  if (m.numeroDocumento) setIdentificacion(m.numeroDocumento);
                  if (m.nombreCompleto) setNombre(m.nombreCompleto);
                }}
              />
            )}
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
              <div>
                <label className="etiqueta" htmlFor="tipoId">Tipo de documento</label>
                <select
                  id="tipoId"
                  className="campo"
                  value={tipoId}
                  onChange={(e) => setTipoId(e.target.value as '05' | '04' | '06' | '08')}
                >
                  <option value="05">Cédula</option>
                  <option value="04">RUC</option>
                  <option value="06">Pasaporte</option>
                  <option value="08">Identificación del Exterior</option>
                </select>
              </div>
              <div>
                <label className="etiqueta" htmlFor="ident">Nº identificación</label>
                <input
                  id="ident"
                  className={`campo ${errorId && identificacion ? 'border-coral-400' : ''}`}
                  // Pasaporte permite texto; cédula/RUC solo números.
                  inputMode={tipoId === '06' ? 'text' : 'numeric'}
                  placeholder={tipoId === '04' ? '13 dígitos' : tipoId === '05' ? '10 dígitos' : 'Ej.: AB123456'}
                  value={identificacion}
                  onChange={(e) => setIdentificacion(e.target.value)}
                  // Al salir del campo, busca si el cliente ya existe (autocompletar).
                  onBlur={buscarCliente}
                />
                {/* Error descriptivo en vivo (nunca "dato inválido" genérico). */}
                {errorId && identificacion && (
                  <p className="mt-1 text-xs text-coral-600">{errorId}</p>
                )}
                {buscandoCliente && <p className="mt-1 text-xs text-slate-400">Buscando cliente…</p>}
              </div>
            </div>
            <div>
              <label className="etiqueta" htmlFor="nombre">Nombres / Razón social</label>
              <input id="nombre" className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <label className="etiqueta" htmlFor="direccion">Dirección (texto libre)</label>
              <div className="flex gap-2">
                <input
                  id="direccion"
                  className="campo flex-1"
                  placeholder="Ej.: Av. Amazonas y Espejo, Baños"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                />
                {/* Botón rápido: rellena "Baños de Agua Santa" al instante. */}
                <button type="button" onClick={usarDireccionBanos} className="btn-secundario shrink-0 px-3 text-sm">
                  📍 Baños
                </button>
              </div>
            </div>
            {/* Nacionalidad autocompletable + género — CRM interno OPCIONAL
                (importante para el BI demográfico; NO se envía al SRI). */}
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
              <div>
                <label className="etiqueta" htmlFor="nacionalidad">Nacionalidad (opcional)</label>
                <input
                  id="nacionalidad"
                  className="campo"
                  list="lista-nacionalidades"
                  placeholder="Escribe para buscar…"
                  value={nacionalidad}
                  onChange={(e) => setNacionalidad(e.target.value)}
                />
                <datalist id="lista-nacionalidades">
                  {NACIONALIDADES.map((n) => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div>
                <label className="etiqueta" htmlFor="genero">Género (opcional, uso interno)</label>
                <select id="genero" className="campo" value={genero} onChange={(e) => setGenero(e.target.value)}>
                  <option value="">—</option>
                  <option value="MASCULINO">Hombre</option>
                  <option value="FEMENINO">Mujer</option>
                  <option value="OTRO">Otro</option>
                  <option value="PREFIERE_NO_DECIR">Prefiere no decir</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
              <div>
                <label className="etiqueta" htmlFor="email">Email (envío del RIDE)</label>
                <input
                  id="email"
                  type="email"
                  className="campo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="etiqueta" htmlFor="tel">Teléfono</label>
                <input
                  id="tel"
                  type="tel"
                  inputMode="numeric"
                  maxLength={15}
                  className={`campo ${errorTelefono ? 'border-coral-400' : ''}`}
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
                {/* Teléfono: solo números; mensaje descriptivo si falla. */}
                {errorTelefono && <p className="mt-1 text-xs text-coral-600">{errorTelefono}</p>}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Incidentales / cargos extra ---------- */}
      <section className="tarjeta p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Cargos adicionales</p>
            <p className="text-[11px] text-slate-500">
              Daños, multas Airbnb, servicios extra… (opcional)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExtras((prev) => [...prev, { descripcion: '', valor: '' }])}
            className="btn-secundario px-3 py-2 text-sm"
          >
            + Añadir
          </button>
        </div>

        {/* Catálogo de productos/servicios: añade un extra prellenado con 1 clic. */}
        {productosCatalogo.length > 0 && (
          <div className="mt-3">
            <label className="etiqueta" htmlFor="prod-catalogo">Añadir del catálogo</label>
            <select
              id="prod-catalogo"
              className="campo"
              value=""
              onChange={(e) => {
                const p = productosCatalogo.find((x) => String(x.id) === e.target.value);
                if (p) setExtras((prev) => [...prev, { descripcion: p.descripcion, valor: String(p.precioUnitario) }]);
              }}
            >
              <option value="">Elegir producto/servicio…</option>
              {productosCatalogo.map((p) => (
                <option key={p.id} value={p.id}>{p.descripcion} — ${p.precioUnitario.toFixed(2)}</option>
              ))}
            </select>
          </div>
        )}

        {extras.length > 0 && (
          <div className="mt-4 space-y-3">
            {extras.map((ex, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="etiqueta" htmlFor={`ex-desc-${i}`}>
                    Concepto
                  </label>
                  <input
                    id={`ex-desc-${i}`}
                    className="campo"
                    placeholder="Ej.: Rotura de vajilla / Limpieza extra"
                    value={ex.descripcion}
                    onChange={(e) =>
                      setExtras((prev) =>
                        prev.map((p, j) => (j === i ? { ...p, descripcion: e.target.value } : p)),
                      )
                    }
                  />
                </div>
                <div className="w-28">
                  <label className="etiqueta" htmlFor={`ex-val-${i}`}>
                    USD
                  </label>
                  <input
                    id={`ex-val-${i}`}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    className="campo"
                    placeholder="0.00"
                    value={ex.valor}
                    onChange={(e) =>
                      setExtras((prev) =>
                        prev.map((p, j) => (j === i ? { ...p, valor: e.target.value } : p)),
                      )
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))}
                  className="btn-secundario mb-0.5 w-11 text-lg text-coral-600"
                  aria-label="Quitar cargo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Resumen y total (sticky en móvil) ---------- */}
      <section className="tarjeta sticky bottom-20 z-30 p-4 md:static md:p-5">
        {calculo ? (
          <>
            <ul className="space-y-1 text-sm text-slate-600">
              {calculo.detallePorHabitacion.map((d, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="line-clamp-1">{d.descripcion}</span>
                  <span className="shrink-0 font-medium">{fmtUsd(d.valor)}</span>
                </li>
              ))}
              {calculo.descuento > 0 && (
                <li className="flex justify-between text-coral-600">
                  <span>Descuento</span>
                  <span>-{fmtUsd(calculo.descuento)}</span>
                </li>
              )}
              <li className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium">{fmtUsd(calculo.baseImponible)}</span>
              </li>
              {extrasValidos.map((ex, i) => (
                <li key={`ex-${i}`} className="flex justify-between gap-2 text-slate-600">
                  <span className="line-clamp-1">+ {ex.descripcion}</span>
                  <span className="shrink-0 font-medium">{fmtUsd(ex.valor)}</span>
                </li>
              ))}
              <li className="flex justify-between">
                <span>IVA {calculo.tarifaIva}%</span>
                <span className="font-medium">{fmtUsd(calculo.valorIva + ivaExtras)}</span>
              </li>
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-lg font-bold">TOTAL</span>
              <span className="text-2xl font-bold text-brand-700">{fmtUsd(totalConExtras)}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-coral-600">Revisa los datos: el cálculo no es válido.</p>
        )}

        {error && <p className="mt-3 rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}

        {/* Este botón NO emite: abre el modal de verificación pre-emisión. */}
        <button
          onClick={revisarYVerificar}
          disabled={!calculo || excedeLimiteCF}
          className="btn-primario mt-4 w-full text-base"
        >
          Revisar y emitir →
        </button>
      </section>

      {/* ================= MODAL DE VERIFICACIÓN PRE-EMISIÓN ================= */}
      {/* Congela el estado y muestra un resumen consolidado. El botón "Emitir"
          está AISLADO aquí, de modo que el usuario revisa antes de que se
          genere el XML, se firme con el .p12 y se envíe al SRI. Reduce
          drásticamente las anulaciones por errores de tipeo. */}
      {mostrarVerificacion && calculo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 md:rounded-2xl">
            <h2 className="text-lg font-bold">Verifica antes de emitir</h2>
            <p className="mb-4 text-xs text-slate-500">Revisa los datos: una vez emitida, corregir requiere anular.</p>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Cliente</dt>
                <dd className="text-right font-medium">
                  {consumidorFinal ? 'CONSUMIDOR FINAL' : nombre || '—'}
                </dd>
              </div>
              {!consumidorFinal && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Identificación</dt>
                  <dd className="text-right font-medium">
                    {tipoId === '05' ? 'CI' : tipoId === '04' ? 'RUC' : 'Pasaporte'} {identificacion}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Habitaciones</dt>
                <dd className="text-right font-medium">
                  {modo === 'CASA_COMPLETA' ? 'Casa completa' : habitacionesSeleccionadas.map((h) => h.numero).join(', ')}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Huéspedes · Noches</dt>
                <dd className="text-right font-medium">{huespedes} · {noches}</dd>
              </div>
              {(checkIn || checkOut) && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Reserva</dt>
                  <dd className="text-right font-medium">{checkIn || '—'} → {checkOut || '—'}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Plataforma</dt>
                <dd className="text-right font-medium">{viaAirbnb || modo === 'AIRBNB' ? 'Vía Airbnb' : 'Directo'}</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
                <dt className="font-semibold">TOTAL</dt>
                <dd className="text-right text-xl font-bold text-brand-700">{fmtUsd(totalConExtras)}</dd>
              </div>
            </dl>

            {(viaAirbnb || modo === 'AIRBNB') && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-700">
                Se incluirá el aviso legal de Airbnb en la factura (se factura el valor neto recibido).
              </p>
            )}

            {error && <p className="mt-3 rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}

            <div className="mt-5 grid gap-2">
              <button onClick={emitir} disabled={enviando} className="btn-primario w-full text-base">
                {enviando ? 'Firmando y enviando al SRI…' : 'Emitir factura electrónica'}
              </button>
              <button onClick={() => setMostrarVerificacion(false)} disabled={enviando} className="btn-secundario w-full">
                Volver a editar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
