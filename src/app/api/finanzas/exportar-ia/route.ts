import { NextResponse } from 'next/server';
import { requiereRol } from '@/lib/auth/servidor';
import { generarExportacionIA } from '@/lib/bi/exportacionIA';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finanzas/exportar-ia?desde=YYYY-MM-DD&hasta=YYYY-MM-DD | ?todo=1
 * Descarga el Markdown para análisis con IA (solo ADMIN). Por defecto: últimos 24 meses.
 */
export async function GET(req: Request) {
  try {
    await requiereRol();
  } catch {
    return NextResponse.json({ error: 'Solo el administrador puede exportar' }, { status: 403 });
  }
  const p = new URL(req.url).searchParams;
  const hoy = new Date();
  const hasta = p.get('hasta') ? new Date(`${p.get('hasta')}T00:00:00`) : new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const hastaExclusivo = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() + 1);
  const desde = p.get('todo')
    ? new Date(2000, 0, 1)
    : p.get('desde')
      ? new Date(`${p.get('desde')}T00:00:00`)
      : new Date(hasta.getFullYear(), hasta.getMonth() - 23, 1);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hastaExclusivo.getTime()) || desde >= hastaExclusivo) {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
  }

  const markdown = await generarExportacionIA({ desde, hasta: hastaExclusivo }, hoy);
  const fecha = hoy.toISOString().slice(0, 10);
  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="analisis-ia-casa-mama-emma-${fecha}.md"`,
    },
  });
}
