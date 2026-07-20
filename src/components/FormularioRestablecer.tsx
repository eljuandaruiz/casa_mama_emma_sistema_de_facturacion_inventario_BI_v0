'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Formulario público para fijar la nueva contraseña con el token del correo. */
export function FormularioRestablecer({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmar) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    try {
      const res = await fetch('/api/auth/restablecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo restablecer');
      setOk(true);
      setTimeout(() => router.replace('/login'), 1800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (!token) {
    return (
      <p className="tarjeta p-6 text-center text-sm text-slate-500">
        Enlace inválido: falta el token. Solicita la recuperación otra vez desde la pantalla de inicio de sesión.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="tarjeta space-y-4 p-6">
      <div>
        <label className="etiqueta" htmlFor="nueva">Nueva contraseña (mín. 8)</label>
        <input
          id="nueva"
          type={ver ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          className="campo"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <label className="etiqueta" htmlFor="confirmar">Repite la contraseña</label>
        <input
          id="confirmar"
          type={ver ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          className="campo"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={ver} onChange={(e) => setVer(e.target.checked)} />
        Mostrar contraseñas
      </label>

      {error && <p className="rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}
      {ok && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">✅ Contraseña actualizada. Redirigiendo al login…</p>}

      <button type="submit" disabled={enviando || ok} className="btn-primario w-full">
        {enviando ? 'Guardando…' : 'Guardar nueva contraseña'}
      </button>
    </form>
  );
}
