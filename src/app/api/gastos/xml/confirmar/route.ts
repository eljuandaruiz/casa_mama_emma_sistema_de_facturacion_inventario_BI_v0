import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';
import { agregarGastoDeducibleASheet } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

const filaSchema = z.object({
  fecha: z.string(), // ISO
  // Categoría dinámica (tabla CategoriaGasto): slug en MAYUSCULAS_CON_GUION.
  categoria: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/),
  proveedor: z.string().min(1),
  rucProveedor: z.string().min(1),
  numeroComprobante: z.string().optional(),
  subtotal: z.coerce.number().min(0),
  iva: z.coerce.number().min(0).default(0),
  deducible: z.boolean().default(true),
});

const schema = z.object({ filas: z.array(filaSchema).min(1).max(50) });

/**
 * POST /api/gastos/xml/confirmar — persiste como `Gasto` las filas ya
 * REVISADAS por el usuario (categoría elegida + toggle "deducible").
 * Cada gasto marcado deducible se intenta sincronizar a Google Sheets
 * (best-effort: si Sheets no está configurado, simplemente no sincroniza).
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalle: parsed.error.flatten() }, { status: 400 });
  }

  const creados: number[] = [];
  for (const f of parsed.data.filas) {
    const gasto = await prisma.gasto.create({
      data: {
        fecha: new Date(f.fecha),
        categoria: f.categoria,
        descripcion: `Factura proveedor ${f.numeroComprobante ?? ''} — ${f.proveedor}`.trim(),
        proveedor: f.proveedor,
        rucProveedor: f.rucProveedor,
        numeroComprobante: f.numeroComprobante || null,
        subtotal: round2(f.subtotal),
        iva: round2(f.iva),
        total: round2(f.subtotal + f.iva),
        formaPago: 'TRANSFERENCIA',
        deducible: f.deducible,
      },
    });
    creados.push(gasto.id);

    // Sync a Google Sheets SOLO si quedó marcado como deducible (best-effort).
    if (f.deducible) {
      void agregarGastoDeducibleASheet({
        fecha: f.fecha,
        proveedor: f.proveedor,
        ruc: f.rucProveedor,
        total: round2(f.subtotal + f.iva),
        iva: round2(f.iva),
        categoria: f.categoria,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, creados: creados.length, ids: creados }, { status: 201 });
}
