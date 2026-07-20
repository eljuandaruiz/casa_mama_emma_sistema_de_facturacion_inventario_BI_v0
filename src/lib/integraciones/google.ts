/**
 * Cliente mínimo de Google Calendar vía API REST (sin la librería googleapis).
 * Flujo OAuth 2.0 "Authorization Code" con refresh token de larga duración.
 *
 * Configuración (.env):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 *
 * El refresh token se obtiene una vez (consentimiento del dueño) y se guarda
 * en la tabla Integraciones. Con él se piden access tokens efímeros.
 */

const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export function googleConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** URL a la que enviar al dueño para autorizar (paso 1 del OAuth). */
export function urlConsentimiento(): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? '',
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // fuerza a devolver refresh_token
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResp {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

/** Paso 2: cambia el "code" del callback por tokens (incluye refresh_token). */
export async function intercambiarCodigo(code: string): Promise<TokenResp> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? '',
      grant_type: 'authorization_code',
    }),
  });
  return (await res.json()) as TokenResp;
}

/** Renueva un access token a partir del refresh token guardado. */
export async function accessTokenDesdeRefresh(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
    }),
  });
  const json = (await res.json()) as TokenResp;
  if (!json.access_token) {
    throw new Error(`Google: no se pudo renovar el token (${json.error_description ?? json.error ?? 'desconocido'})`);
  }
  return json.access_token;
}

/** Datos de la persona autenticada (para mostrar qué cuenta se conectó). */
export async function emailDeToken(accessToken: string): Promise<string | undefined> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const j = (await res.json()) as { email?: string };
  return j.email;
}

export interface EventoCalendario {
  titulo: string;
  descripcion: string;
  inicio: Date;
  fin: Date;
  /** Todo el día (reservas de hospedaje). */
  diaCompleto?: boolean;
}

function cuerpoEvento(e: EventoCalendario) {
  if (e.diaCompleto) {
    const d = (x: Date) => x.toISOString().slice(0, 10);
    return {
      summary: e.titulo,
      description: e.descripcion,
      start: { date: d(e.inicio) },
      end: { date: d(e.fin) },
    };
  }
  return {
    summary: e.titulo,
    description: e.descripcion,
    start: { dateTime: e.inicio.toISOString() },
    end: { dateTime: e.fin.toISOString() },
  };
}

/** Crea (o actualiza si se pasa eventoId) un evento. Devuelve el id del evento. */
export async function upsertEvento(
  accessToken: string,
  calendarId: string,
  evento: EventoCalendario,
  eventoId?: string | null,
): Promise<string> {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const url = eventoId ? `${base}/${encodeURIComponent(eventoId)}` : base;
  const res = await fetch(url, {
    method: eventoId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpoEvento(evento)),
  });
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(`Google Calendar: ${json.error?.message ?? res.statusText}`);
  }
  return json.id;
}
