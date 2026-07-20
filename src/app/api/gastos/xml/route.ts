import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseGastoXml } from '@/lib/xmlGastoParser';

export const dynamic = 'force-dynamic';

const schema = z.object({
  // Cada archivo: nombre + contenido de texto del XML (el navegador ya lo
  // lee como texto antes de enviarlo; no hace falta base64).
  archivos: z.array(z.object({ nombre: z.string(), contenido: z.string() })).min(1).max(50),
});

/**
 * POST /api/gastos/xml — PREVIEW: parsea N archivos .xml de facturas
 * recibidas (proveedores) y devuelve los datos extraídos SIN GUARDAR nada.
 * El usuario revisa/edita categoría y "deducible" en la tabla del frontend
 * antes de confirmar con POST /api/gastos/xml/confirmar.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const resultados = parsed.data.archivos.map((a) => ({
    ...parseGastoXml(a.contenido, a.nombre),
    archivo: a.nombre,
  }));

  return NextResponse.json({ resultados });
}
