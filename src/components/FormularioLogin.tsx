'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FormularioLogin({ next }: { next?: string }) {
  const router = useRouter();
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Recuperación de contraseña por correo (flujo tradicional).
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [mensajeRecuperar, setMensajeRecuperar] = useState('');

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Se envía como "identificador": el backend acepta usuario o email.
        body: JSON.stringify({ identificador: identificador.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo iniciar sesión');
      // router.refresh() para que el layout servidor relea la sesión.
      router.replace(next || '/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const solicitarRecuperacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMensajeRecuperar('');
    setEnviando(true);
    try {
      const res = await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: identificador.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo enviar el correo');
      setMensajeRecuperar(json.mensaje);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (modoRecuperar) {
    return (
      <form onSubmit={solicitarRecuperacion} className="tarjeta space-y-4 p-6">
        <div>
          <h2 className="font-semibold">Recuperar contraseña</h2>
          <p className="mt-1 text-xs text-slate-500">
            Escribe tu usuario o email y te enviaremos un enlace para crear una nueva contraseña.
          </p>
        </div>
        <div>
          <label className="etiqueta" htmlFor="usuario-rec">Usuario o email</label>
          <input
            id="usuario-rec"
            type="text"
            autoComplete="username"
            required
            className="campo"
            placeholder="Ej.: admin"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
          />
        </div>

        {error && <p className="rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}
        {mensajeRecuperar && (
          <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{mensajeRecuperar}</p>
        )}

        <button type="submit" disabled={enviando} className="btn-primario w-full">
          {enviando ? 'Enviando…' : 'Enviar enlace de recuperación'}
        </button>
        <button
          type="button"
          className="w-full text-center text-sm text-slate-500 underline"
          onClick={() => { setModoRecuperar(false); setError(''); setMensajeRecuperar(''); }}
        >
          Volver al inicio de sesión
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={entrar} className="tarjeta space-y-4 p-6">
      <div>
        <label className="etiqueta" htmlFor="usuario">
          Usuario
        </label>
        <input
          id="usuario"
          type="text"
          autoComplete="username"
          required
          className="campo"
          placeholder="Ej.: admin"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
        />
      </div>
      <div>
        <label className="etiqueta" htmlFor="password">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            type={verPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="campo pr-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {/* Botón "ver contraseña" (alterna texto/puntos) */}
          <button
            type="button"
            aria-label={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600"
            onClick={() => setVerPassword(!verPassword)}
          >
            {verPassword ? (
              /* ojo tachado */
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              /* ojo */
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}

      <button type="submit" disabled={enviando} className="btn-primario w-full">
        {enviando ? 'Entrando…' : 'Iniciar sesión'}
      </button>
      <button
        type="button"
        className="w-full text-center text-sm text-slate-500 underline"
        onClick={() => { setModoRecuperar(true); setError(''); }}
      >
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  );
}
