import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';
import { etiquetaArea } from '@/lib/areas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mejoras — devuelve todas las mejoras + un RESUMEN de capital
 * invertido por área (para la tabla resumen y el timeline por habitación).
 */
export async function GET() {
  const mejoras = await prisma.mejora.findMany({ orderBy: { fecha: 'desc' } });

  // Resumen: total de capital invertido por área.
  const porArea = new Map<string, { area: string; areaEtiqueta: string; total: number; n: number }>();
  for (const m of mejoras) {
    const g = porArea.get(m.area) ?? { area: m.area, areaEtiqueta: etiquetaArea(m.area), total: 0, n: 0 };
    g.total += m.costo;
    g.n += 1;
    porArea.set(m.area, g);
  }
  const resumen = [...porArea.values()]
    .map((g) => ({ ...g, total: round2(g.total) }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    mejoras: mejoras.map((m) => ({
      id: m.id,
      area: m.area,
      areaEtiqueta: etiquetaArea(m.area),
      descripcion: m.descripcion,
      costo: m.costo,
      numeroFactura: m.numeroFactura,
      imagen: m.imagen,
      fecha: m.fecha,
    })),
    resumen,
    totalGlobal: round2(mejoras.reduce((a, m) => a + m.costo, 0)),
  });
}

const schema = z.object({
  area: z.string().min(2).max(20),
  descripcion: z.string().trim().min(2).max(200),
  costo: z.coerce.number().min(0),
  numeroFactura: z.string().max(40).optional(),
  imagen: z.string().startsWith('data:image/').optional().or(z.literal('')),
  fecha: z.string().optional(),
});

/** POST /api/mejoras — registra una mejora (upgrade de capital). */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;
  const m = await prisma.mejora.create({
    data: {
      area: d.area,
      descripcion: d.descripcion,
      costo: d.costo,
      numeroFactura: d.numeroFactura || null,
      imagen: d.imagen || null,
      fecha: d.fecha ? new Date(d.fecha) : new Date(),
    },
  });
  return NextResponse.json({ id: m.id }, { status: 201 });
}
