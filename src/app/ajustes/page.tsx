'use client';

/** Ajustes: marca, direcciones (texto libre), leyenda del RIDE y tarifas por habitación. */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { comprimirImagen } from '@/lib/imagen';

interface ConfigDto {
  dirMatriz: string;
  dirEstablecimiento: string;
  obligadoContabilidad: 'SI' | 'NO';
  leyendaRide: string | null;
  establecimiento: string | null;
  puntoEmision: string | null;
  nombreComercial: string | null;
  logoUrl: string | null;
}

interface HabitacionDto {
  id: number;
  nombre: string;
  descripcionCamas: string;
  precioHabitacion: number;
  precioPersona: number;
}

export default function PaginaAjustes() {
  const router = useRouter();
  const [config, setConfig] = useState<ConfigDto | null>(null);
  const [habitaciones, setHabitaciones] = useState<HabitacionDto[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  useEffect(() => {
    void fetch('/api/configuracion').then((r) => r.json()).then(setConfig);
    void fetch('/api/habitaciones').then((r) => r.json()).then(setHabitaciones);
  }, []);

  const guardarConfig = async () => {
    if (!config) return;
    await fetch('/api/configuracion', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dirMatriz: config.dirMatriz,
        dirEstablecimiento: config.dirEstablecimiento,
        obligadoContabilidad: config.obligadoContabilidad,
        leyendaRide: config.leyendaRide ?? '',
        establecimiento: config.establecimiento ?? '',
        puntoEmision: config.puntoEmision ?? '',
        nombreComercial: config.nombreComercial ?? '',
        logoUrl: config.logoUrl ?? '',
      }),
    });
    setMensaje('✅ Configuración guardada');
    setTimeout(() => setMensaje(''), 2500);
    router.refresh();
  };

  const subirLogo = async (file: File | undefined) => {
    if (!file || !config) return;
    setSubiendoLogo(true);
    try {
      const dataUri = await comprimirImagen(file, 300, 0.85);
      setConfig({ ...config, logoUrl: dataUri });
    } finally {
      setSubiendoLogo(false);
    }
  };

  const guardarHabitacion = async (h: HabitacionDto) => {
    await fetch('/api/habitaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: h.id,
        nombre: h.nombre,
        descripcionCamas: h.descripcionCamas,
        precioHabitacion: h.precioHabitacion,
        precioPersona: h.precioPersona,
      }),
    });
    setMensaje(`✅ ${h.nombre} guardada`);
    setTimeout(() => setMensaje(''), 2500);
  };

  if (!config) return <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-5 pb-8">
      <h1 className="text-2xl font-bold">Ajustes</h1>
      {mensaje && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{mensaje}</p>}

      <section className="tarjeta space-y-3 p-4 md:p-5">
        <h2 className="font-semibold">Marca</h2>
        <p className="text-xs text-slate-400">
          El nombre y el ícono que ven tus usuarios en el login, el menú y la pestaña del navegador.
          No afecta la razón social ni los datos del SRI (eso se configura en <code>.env</code>).
        </p>
        <div className="flex items-center gap-4">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="Ícono del negocio" className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[10px] text-slate-400">
              Sin ícono
            </div>
          )}
          <div className="space-y-1">
            <label className="btn-secundario inline-block cursor-pointer text-sm">
              {subiendoLogo ? 'Subiendo…' : 'Cambiar ícono'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={subiendoLogo}
                onChange={(e) => void subirLogo(e.target.files?.[0])}
              />
            </label>
            {config.logoUrl && (
              <button
                type="button"
                className="block text-xs text-coral-600 underline"
                onClick={() => setConfig({ ...config, logoUrl: null })}
              >
                Quitar ícono
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="etiqueta">Nombre del negocio</label>
          <input
            className="campo"
            placeholder="Casa Mamá Emma"
            value={config.nombreComercial ?? ''}
            onChange={(e) => setConfig({ ...config, nombreComercial: e.target.value })}
          />
        </div>
      </section>

      <section className="tarjeta space-y-3 p-4 md:p-5">
        <h2 className="font-semibold">Emisor (SRI)</h2>
        <div>
          <label className="etiqueta">Dirección matriz (texto libre)</label>
          <input
            className="campo"
            value={config.dirMatriz}
            onChange={(e) => setConfig({ ...config, dirMatriz: e.target.value })}
          />
        </div>
        <div>
          <label className="etiqueta">Dirección del establecimiento (texto libre)</label>
          <input
            className="campo"
            value={config.dirEstablecimiento}
            onChange={(e) => setConfig({ ...config, dirEstablecimiento: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
          <div>
            <label className="etiqueta">Obligado a llevar contabilidad</label>
            <select
              className="campo"
              value={config.obligadoContabilidad}
              onChange={(e) => setConfig({ ...config, obligadoContabilidad: e.target.value as 'SI' | 'NO' })}
            >
              <option value="NO">NO</option>
              <option value="SI">SI</option>
            </select>
          </div>
          <div>
            <label className="etiqueta">Mensaje que aparece en la factura</label>
            <input
              className="campo"
              placeholder="Ej.: ¡Gracias por hospedarse con nosotros!"
              value={config.leyendaRide ?? ''}
              onChange={(e) => setConfig({ ...config, leyendaRide: e.target.value })}
            />
          </div>
        </div>

        {/* Código de referencia de la factura (serie), editable. */}
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-sm font-semibold">Código de referencia de la factura</p>
          <p className="mb-2 text-xs text-slate-400">
            Serie del comprobante: <b>Establecimiento - Punto de emisión - Secuencial</b>.
            Déjalos vacíos para usar el valor del archivo <code>.env</code>.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiqueta">Establecimiento</label>
              <input
                className="campo"
                inputMode="numeric"
                maxLength={3}
                placeholder="001"
                value={config.establecimiento ?? ''}
                onChange={(e) => setConfig({ ...config, establecimiento: e.target.value.replace(/\D/g, '').slice(0, 3) })}
              />
            </div>
            <div>
              <label className="etiqueta">Punto de emisión</label>
              <input
                className="campo"
                inputMode="numeric"
                maxLength={3}
                placeholder="001"
                value={config.puntoEmision ?? ''}
                onChange={(e) => setConfig({ ...config, puntoEmision: e.target.value.replace(/\D/g, '').slice(0, 3) })}
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-amber-600">
            ⚠️ Cambiar la serie afecta el número y la clave de acceso de las próximas facturas.
            Cada serie lleva su propia numeración desde 000000001.
          </p>
        </div>

        <button onClick={guardarConfig} className="btn-primario">Guardar configuración</button>
        <p className="text-xs text-slate-400">
          RUC, razón social, ambiente SRI y certificado .p12 se configuran en el
          archivo <code>.env</code> (ver README).
        </p>
      </section>

      <section className="tarjeta space-y-4 p-4 md:p-5">
        <h2 className="font-semibold">Habitaciones (nombre, camas y tarifas)</h2>
        {habitaciones.map((h, idx) => (
          <div key={h.id} className="rounded-xl border border-slate-100 p-3">
            {/* Nombre y descripción de camas EDITABLES por el admin. */}
            <div className="mb-3 grid grid-cols-1 gap-3 xs:grid-cols-2">
              <div>
                <label className="etiqueta">Nombre de la habitación</label>
                <input
                  className="campo"
                  value={h.nombre}
                  onChange={(e) => {
                    const copia = [...habitaciones];
                    copia[idx] = { ...h, nombre: e.target.value };
                    setHabitaciones(copia);
                  }}
                />
              </div>
              <div>
                <label className="etiqueta">Descripción de camas</label>
                <input
                  className="campo"
                  value={h.descripcionCamas}
                  onChange={(e) => {
                    const copia = [...habitaciones];
                    copia[idx] = { ...h, descripcionCamas: e.target.value };
                    setHabitaciones(copia);
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="etiqueta">$/noche (habitación)</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  className="campo"
                  value={h.precioHabitacion}
                  onChange={(e) => {
                    const copia = [...habitaciones];
                    copia[idx] = { ...h, precioHabitacion: Number(e.target.value) };
                    setHabitaciones(copia);
                  }}
                />
              </div>
              <div>
                <label className="etiqueta">$/persona/noche</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  className="campo"
                  value={h.precioPersona}
                  onChange={(e) => {
                    const copia = [...habitaciones];
                    copia[idx] = { ...h, precioPersona: Number(e.target.value) };
                    setHabitaciones(copia);
                  }}
                />
              </div>
            </div>
            <button onClick={() => guardarHabitacion(h)} className="btn-secundario mt-2 w-full text-sm">
              Guardar habitación
            </button>
          </div>
        ))}
      </section>

      {/* Presets de GANANCIA NETA por persona/noche (chips del formulario de factura). */}
      <SeccionPresets />
    </div>
  );
}

function SeccionPresets() {
  const [presets, setPresets] = useState<{ id: number; nombre: string; gananciaPorPersona: number }[]>([]);
  const cargar = () => void fetch('/api/tarifas').then((r) => r.json()).then(setPresets);
  useEffect(() => cargar(), []);

  const editar = async (p: { id: number; nombre: string; gananciaPorPersona: number }) => {
    const v = prompt(`Ganancia neta por persona/noche para "${p.nombre}" (USD):`, String(p.gananciaPorPersona));
    if (v === null) return;
    const n = Number(v);
    if (Number.isNaN(n) || n <= 0) return alert('Valor inválido');
    await fetch('/api/tarifas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, gananciaPorPersona: n }),
    });
    cargar();
  };

  const crear = async () => {
    const nombre = prompt('Nombre del preset (ej.: Temporada alta):');
    if (!nombre?.trim()) return;
    const v = prompt('Ganancia neta por persona/noche (USD):');
    const n = Number(v);
    if (!v || Number.isNaN(n) || n <= 0) return alert('Valor inválido');
    await fetch('/api/tarifas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), gananciaPorPersona: n }),
    });
    cargar();
  };

  const quitar = async (id: number) => {
    if (!confirm('¿Quitar este preset del formulario de factura?')) return;
    await fetch('/api/tarifas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activa: false }),
    });
    cargar();
  };

  return (
    <section className="tarjeta space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Ganancia objetivo (presets de tarifa)</h2>
          <p className="text-xs text-slate-500">
            Lo que quieres GANAR neto por persona/noche; el formulario calcula el precio según el canal (directo/Airbnb) y el IVA.
          </p>
        </div>
        <button onClick={crear} className="btn-primario text-sm">+ Preset</button>
      </div>
      <ul className="space-y-1 text-sm">
        {presets.map((p) => (
          <li key={p.id} className="flex items-center justify-between border-b border-slate-50 py-1.5">
            <span>{p.nombre}</span>
            <span className="flex items-center gap-2">
              <button onClick={() => editar(p)} className="font-bold text-brand-700 underline decoration-dotted">
                ${p.gananciaPorPersona}/persona/noche
              </button>
              <button onClick={() => quitar(p.id)} className="text-slate-300 hover:text-coral-600" aria-label="Quitar">✕</button>
            </span>
          </li>
        ))}
        {presets.length === 0 && <p className="py-2 text-slate-400">Sin presets activos.</p>}
      </ul>
    </section>
  );
}
