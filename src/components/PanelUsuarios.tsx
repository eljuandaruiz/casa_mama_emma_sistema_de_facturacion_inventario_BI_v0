'use client';

/**
 * Gestión de usuarios (solo ADMIN): crear usuarios, cambiar su rol,
 * activarlos/desactivarlos y resetear su contraseña.
 */
import { useCallback, useEffect, useState } from 'react';
import { ROLES_LISTA } from '@/lib/auth/roles';
import { comprimirImagen } from '@/lib/imagen';

interface Usuario {
  id: number;
  email: string;
  nombre: string;
  foto: string | null;
  rol: string;
  activo: boolean;
  ultimoIngreso: string | null;
}

function Avatar({ nombre, foto, size = 40 }: { nombre: string; foto: string | null; size?: number }) {
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={foto} alt={nombre} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const inicial = nombre.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className="flex items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700"
      style={{ width: size, height: size }}
    >
      {inicial}
    </div>
  );
}

const FORM_VACIO = { email: '', nombre: '', rol: 'FACTURADOR', password: '' };

export function PanelUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [alta, setAlta] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const cargar = useCallback(() => {
    void fetch('/api/usuarios').then((r) => r.json()).then(setUsuarios);
  }, []);
  useEffect(() => cargar(), [cargar]);

  const crear = async () => {
    setError('');
    setMsg('');
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (res.ok) {
      setMsg('✅ Usuario creado.');
      setForm({ ...FORM_VACIO });
      setAlta(false);
      cargar();
    } else setError(json.error ?? 'No se pudo crear.');
  };

  const editar = async (id: number, cambios: { rol?: string; activo?: boolean; password?: string; nombre?: string; foto?: string }) => {
    const res = await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...cambios }),
    });
    if (res.ok) cargar();
  };

  const resetear = async (id: number) => {
    const nueva = window.prompt('Nueva contraseña (mín. 6 caracteres):');
    if (!nueva || nueva.length < 6) return;
    await editar(id, { password: nueva });
    window.alert('Contraseña actualizada.');
  };

  const iniciarEdicion = (u: Usuario) => {
    setEditandoId(u.id);
    setNombreEdit(u.nombre);
  };

  const guardarEdicion = async (id: number) => {
    if (nombreEdit.trim().length >= 2) await editar(id, { nombre: nombreEdit.trim() });
    setEditandoId(null);
  };

  const subirFoto = async (id: number, file: File | undefined) => {
    if (!file) return;
    setSubiendoFoto(true);
    try {
      const dataUri = await comprimirImagen(file, 200, 0.8);
      await editar(id, { foto: dataUri });
    } finally {
      setSubiendoFoto(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-slate-500">Gestión de accesos y roles</p>
        </div>
        <button onClick={() => setAlta((v) => !v)} className="btn-primario text-sm">
          {alta ? 'Cerrar' : '+ Usuario'}
        </button>
      </header>

      {msg && <p className="tarjeta bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}

      {alta && (
        <section className="tarjeta space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="etiqueta">Nombre</label>
              <input className="campo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Correo</label>
              <input type="email" className="campo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Rol</label>
              <select className="campo" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                {ROLES_LISTA.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta">Contraseña</label>
              <input type="text" className="campo" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button onClick={crear} className="btn-primario w-full">Crear usuario</button>
        </section>
      )}

      <ul className="space-y-2">
        {usuarios.map((u) => (
          <li key={u.id} className="tarjeta flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <label className="relative cursor-pointer" title="Cambiar foto">
                <Avatar nombre={u.nombre} foto={u.foto} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={subiendoFoto}
                  onChange={(e) => void subirFoto(u.id, e.target.files?.[0])}
                />
              </label>
              <div>
                {editandoId === u.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      className="campo max-w-[160px] py-1 text-sm"
                      value={nombreEdit}
                      autoFocus
                      onChange={(e) => setNombreEdit(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && guardarEdicion(u.id)}
                    />
                    <button onClick={() => guardarEdicion(u.id)} className="btn-secundario px-2 py-1 text-xs">
                      Guardar
                    </button>
                  </div>
                ) : (
                  <p className="font-medium">
                    <button onClick={() => iniciarEdicion(u)} className="hover:underline">
                      {u.nombre}
                    </button>{' '}
                    {!u.activo && <span className="text-xs text-coral-600">(inactivo)</span>}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  {u.email} · último ingreso: {u.ultimoIngreso ? new Date(u.ultimoIngreso).toLocaleDateString('es-EC') : 'nunca'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="campo max-w-[160px] py-1.5 text-sm"
                value={u.rol}
                onChange={(e) => editar(u.id, { rol: e.target.value })}
              >
                {ROLES_LISTA.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
              </select>
              <button onClick={() => editar(u.id, { activo: !u.activo })} className="btn-secundario px-3 py-1.5 text-xs">
                {u.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button onClick={() => resetear(u.id)} className="btn-secundario px-3 py-1.5 text-xs">
                Reset clave
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
