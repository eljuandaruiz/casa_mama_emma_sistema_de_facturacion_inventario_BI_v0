'use client';

/**
 * Formulario público del portal del huésped, BILINGÜE (ES/EN).
 *
 * i18n escalable: todos los textos viven en el diccionario `T` indexado por
 * idioma; para añadir otro idioma se agrega una clave más (p. ej. 'fr') y la
 * lista de nacionalidades se reordena alfabéticamente sola según el locale
 * (ver src/lib/paises.ts).
 */
import { useState } from 'react';
import { nacionalidades, type Idioma } from '@/lib/paises';

const T = {
  es: {
    titulo: 'Datos para tu factura',
    subtitulo: 'Completa tus datos antes o al momento de llegar.',
    nombre: 'Nombre completo / Razón social *',
    tipoDoc: 'Tipo de documento *',
    cedula: 'Cédula',
    pasaporte: 'Pasaporte',
    ruc: 'RUC',
    numDoc: 'Número de documento *',
    dirPlaceholder: 'Ciudad, calle…',
    direccion: 'Dirección',
    nacionalidad: 'Nacionalidad',
    nacionalidadPh: 'Elige o escribe…',
    email: 'Email (para recibir tu factura)',
    telefono: 'Teléfono',
    habitacion: 'Habitación (si la conoces)',
    mensaje: 'Mensaje (opcional)',
    enviar: 'Enviar mis datos',
    enviando: 'Enviando…',
    graciasTitulo: '¡Gracias!',
    graciasTexto: 'Recibimos tus datos de facturación. El equipo de Casa Mamá Emma preparará tu factura.',
    otraVez: 'Enviar otra solicitud',
    errorGen: 'No se pudo enviar',
    docPh: { '05': '10 dígitos', '04': '13 dígitos', '06': 'Pasaporte' } as Record<string, string>,
  },
  en: {
    titulo: 'Billing information',
    subtitulo: 'Fill in your details before or upon arrival.',
    nombre: 'Full name / Company name *',
    tipoDoc: 'Document type *',
    cedula: 'Ecuadorian ID (cédula)',
    pasaporte: 'Passport',
    ruc: 'RUC (tax ID)',
    numDoc: 'Document number *',
    dirPlaceholder: 'City, street…',
    direccion: 'Address',
    nacionalidad: 'Nationality',
    nacionalidadPh: 'Choose or type…',
    email: 'Email (to receive your invoice)',
    telefono: 'Phone',
    habitacion: 'Room (if you know it)',
    mensaje: 'Message (optional)',
    enviar: 'Submit my details',
    enviando: 'Sending…',
    graciasTitulo: 'Thank you!',
    graciasTexto: 'We received your billing details. The Casa Mamá Emma team will prepare your invoice.',
    otraVez: 'Send another request',
    errorGen: 'Could not submit',
    docPh: { '05': '10 digits', '04': '13 digits', '06': 'Passport' } as Record<string, string>,
  },
} satisfies Record<Idioma, unknown>;

const CAMPOS_VACIOS = {
  nombre: '',
  tipoIdentificacion: '05' as '05' | '06' | '04',
  identificacion: '',
  direccion: '',
  nacionalidad: '',
  email: '',
  telefono: '',
  numeroHabitacion: '',
  mensaje: '',
};

export function FormularioPortal() {
  const [idioma, setIdioma] = useState<Idioma>('es');
  const t = T[idioma];
  const [form, setForm] = useState({ ...CAMPOS_VACIOS });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          numeroHabitacion: form.numeroHabitacion ? Number(form.numeroHabitacion) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t.errorGen);
      setEnviado(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const selectorIdioma = (
    <div className="flex justify-end gap-1">
      {(['es', 'en'] as Idioma[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setIdioma(l)}
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
            idioma === l ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );

  if (enviado) {
    return (
      <div className="tarjeta p-8 text-center">
        <span className="text-5xl">✅</span>
        <h1 className="mt-3 text-xl font-bold">{t.graciasTitulo}</h1>
        <p className="mt-2 text-sm text-slate-600">{t.graciasTexto}</p>
        <button
          onClick={() => {
            setForm({ ...CAMPOS_VACIOS });
            setEnviado(false);
          }}
          className="btn-secundario mt-6"
        >
          {t.otraVez}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="tarjeta space-y-4 p-6">
      {selectorIdioma}
      <div>
        <h1 className="text-lg font-bold">{t.titulo}</h1>
        <p className="text-xs text-slate-500">{t.subtitulo}</p>
      </div>

      <div>
        <label className="etiqueta" htmlFor="nombre">{t.nombre}</label>
        <input id="nombre" required className="campo" value={form.nombre} onChange={set('nombre')} />
      </div>

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="tipo">{t.tipoDoc}</label>
          <select id="tipo" className="campo" value={form.tipoIdentificacion} onChange={set('tipoIdentificacion')}>
            <option value="05">{t.cedula}</option>
            <option value="06">{t.pasaporte}</option>
            <option value="04">{t.ruc}</option>
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="ident">{t.numDoc}</label>
          <input
            id="ident"
            required
            className="campo"
            inputMode={form.tipoIdentificacion === '06' ? 'text' : 'numeric'}
            placeholder={t.docPh[form.tipoIdentificacion]}
            value={form.identificacion}
            onChange={set('identificacion')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="dir">{t.direccion}</label>
          <input id="dir" className="campo" placeholder={t.dirPlaceholder} value={form.direccion} onChange={set('direccion')} />
        </div>
        <div>
          {/* Nacionalidad: lista SIEMPRE alfabética en el idioma activo. */}
          <label className="etiqueta" htmlFor="nac">{t.nacionalidad}</label>
          <input
            id="nac"
            className="campo"
            list="nacionalidades-portal"
            placeholder={t.nacionalidadPh}
            value={form.nacionalidad}
            onChange={set('nacionalidad')}
          />
          <datalist id="nacionalidades-portal">
            {nacionalidades(idioma).map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="email">{t.email}</label>
          <input id="email" type="email" className="campo" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="tel">{t.telefono}</label>
          <input id="tel" type="tel" maxLength={15} inputMode="tel" className="campo" value={form.telefono} onChange={set('telefono')} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="hab">{t.habitacion}</label>
          <select id="hab" className="campo" value={form.numeroHabitacion} onChange={set('numeroHabitacion')}>
            <option value="">—</option>
            {[2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {idioma === 'es' ? `Habitación ${n}` : `Room ${n}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="etiqueta" htmlFor="msg">{t.mensaje}</label>
        <textarea id="msg" className="campo min-h-[64px]" value={form.mensaje} onChange={set('mensaje')} />
      </div>

      {error && <p className="rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}

      <button type="submit" disabled={enviando} className="btn-primario w-full">
        {enviando ? t.enviando : t.enviar}
      </button>
    </form>
  );
}
