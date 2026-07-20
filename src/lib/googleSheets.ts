/**
 * Sincronización con Google Sheets — LIBRO DE GASTOS DEDUCIBLES en la nube.
 *
 * Usa una CUENTA DE SERVICIO (Service Account), no OAuth de usuario: no hace
 * falta que nadie haga clic en una pantalla de consentimiento. La cuenta de
 * servicio firma su propio JWT y lo canjea por un access token — flujo
 * "servidor a servidor", ideal para un job automático que corre sin
 * supervisión cada vez que se confirma un gasto deducible.
 *
 * CONFIGURACIÓN (.env):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL      -> "algo@proyecto.iam.gserviceaccount.com"
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY -> la clave privada del JSON descargado
 *                                         (con los \n literales conservados)
 *   GOOGLE_SHEETS_SPREADSHEET_ID       -> el ID de la hoja (de su URL)
 *
 * CÓMO OBTENER LA CUENTA DE SERVICIO (una sola vez, ver INTEGRACION_SRI.md /
 * DOCUMENTACION.md para el paso a paso completo):
 *   1. Google Cloud Console → IAM y administración → Cuentas de servicio → Crear.
 *   2. Crear una clave JSON para esa cuenta (se descarga un archivo .json).
 *   3. Copiar `client_email` y `private_key` del JSON al .env.
 *   4. Compartir la hoja de Sheets con ese `client_email` (como Editor),
 *      igual que se comparte con una persona.
 *
 * No se usa el SDK `googleapis` (pesado); se firma el JWT con `node:crypto` y
 * se llama a la API REST de Sheets v4 directo con `fetch`, siguiendo el mismo
 * patrón minimalista que el resto de integraciones de este proyecto.
 */
import crypto from 'node:crypto';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const HOJA_NOMBRE = 'GastosDeducibles';
// Encabezados exigidos: Date, Supplier Name, RUC, Total Amount, IVA, Category.
const ENCABEZADOS = ['Fecha', 'Proveedor', 'RUC', 'Monto Total', 'IVA', 'Categoría'];

export function sheetsConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  );
}

/** Base64url sin relleno, como exige JWT. */
function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Construye y firma el JWT de la cuenta de servicio (RS256) y lo canjea por
 * un access token de corta duración (1 hora) en el endpoint de Google.
 * Es el equivalente exacto de lo que hace `googleapis`/`google-auth-library`
 * por debajo, pero sin la dependencia.
 */
async function obtenerAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  // El .env suele traer la clave con "\n" literales (no saltos reales); se
  // normalizan a saltos de línea reales, que es lo que espera el PEM.
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n');

  const ahora = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: email,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: ahora,
      exp: ahora + 3600, // 1 hora, máximo permitido por Google
    }),
  );
  const firmable = `${header}.${claim}`;
  const firma = crypto.sign('RSA-SHA256', Buffer.from(firmable), privateKey);
  const jwt = `${firmable}.${base64url(firma)}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!json.access_token) {
    throw new Error(`Google Sheets: no se pudo autenticar (${json.error_description ?? 'error desconocido'})`);
  }
  return json.access_token;
}

/**
 * Se asegura de que la hoja "GastosDeducibles" exista con sus encabezados y
 * una fórmula de SUMA automática en la columna de Total (fila 1, junto al
 * encabezado). Se llama antes de cada apertura; es barata e idempotente.
 */
async function asegurarEncabezados(token: string, spreadsheetId: string): Promise<void> {
  const rango = `${HOJA_NOMBRE}!A1:H1`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rango)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = (await res.json()) as { values?: string[][] };
  if (data.values && data.values[0]?.[0] === ENCABEZADOS[0]) return; // ya inicializada

  // Fila 1: encabezados + rótulo y fórmula de suma total (columnas G/H).
  // La fórmula SUMA(D:D) cubre TODA la columna, así que crece automáticamente
  // sin importar cuántas filas se agreguen después (requisito de "Automated Math").
  const filaEncabezado = [...ENCABEZADOS, '', 'TOTAL DEDUCIBLE:', '=SUM(D2:D100000)'];
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${HOJA_NOMBRE}!A1:H1`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [filaEncabezado] }),
    },
  );
}

/**
 * DOCUMENTOS AUTOMÁTICOS: escribe (o reemplaza) una PESTAÑA completa del
 * libro configurado con las filas dadas. Crea la pestaña si no existe.
 * Con `valueInputOption=USER_ENTERED` las fórmulas (=SUM…) se evalúan.
 * Devuelve la URL directa a la pestaña generada.
 */
export async function escribirHojaDocumento(
  nombreHoja: string,
  filas: (string | number)[][],
): Promise<{ ok: boolean; url?: string; motivo?: string }> {
  if (!sheetsConfigurado()) return { ok: false, motivo: 'Google Sheets no configurado (ver .env.example)' };
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
    const token = await obtenerAccessToken();
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // 1. Crear la pestaña (si ya existe, Google responde error: se ignora).
    const crea = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: nombreHoja } } }] }),
    });
    const creaJson = (await crea.json()) as { replies?: { addSheet?: { properties?: { sheetId?: number } } }[]; error?: { message?: string } };
    let sheetId = creaJson.replies?.[0]?.addSheet?.properties?.sheetId;

    // 2. Si ya existía, limpiar el contenido anterior y averiguar su sheetId.
    if (sheetId === undefined) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(nombreHoja)}:clear`,
        { method: 'POST', headers: auth },
      );
      const meta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, { headers: auth });
      const metaJson = (await meta.json()) as { sheets?: { properties: { sheetId: number; title: string } }[] };
      sheetId = metaJson.sheets?.find((s) => s.properties.title === nombreHoja)?.properties.sheetId;
    }

    // 3. Escribir todas las filas de una vez.
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${nombreHoja}!A1`)}?valueInputOption=USER_ENTERED`,
      { method: 'PUT', headers: auth, body: JSON.stringify({ values: filas }) },
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, motivo: err.error?.message ?? `HTTP ${res.status}` };
    }
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit${sheetId !== undefined ? `#gid=${sheetId}` : ''}`;
    return { ok: true, url };
  } catch (e) {
    return { ok: false, motivo: (e as Error).message };
  }
}

export interface GastoDeducibleSheet {
  fecha: string; // ISO
  proveedor: string;
  ruc: string;
  total: number;
  iva: number;
  categoria: string;
}

/**
 * Agrega una fila al libro de gastos deducibles en Google Sheets.
 * Best-effort: si Sheets no está configurado o falla, NO lanza (se llama
 * de forma no bloqueante desde /api/gastos/xml/confirmar).
 */
export async function agregarGastoDeducibleASheet(g: GastoDeducibleSheet): Promise<{ ok: boolean; motivo?: string }> {
  if (!sheetsConfigurado()) return { ok: false, motivo: 'Google Sheets no configurado' };

  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
    const token = await obtenerAccessToken();
    await asegurarEncabezados(token, spreadsheetId);

    const fila = [g.fecha, g.proveedor, g.ruc, g.total, g.iva, g.categoria];
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${HOJA_NOMBRE}!A:F`)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [fila] }),
      },
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, motivo: err.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: (e as Error).message };
  }
}
