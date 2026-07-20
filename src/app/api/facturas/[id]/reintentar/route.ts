import { NextResponse } from 'next/server';
import { reintentarEmision } from '@/lib/sri/procesoEmision';

export const dynamic = 'force-dynamic';

/** POST /api/facturas/:id/reintentar — reenvía/consulta autorización (esquema offline 72h) */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const resultado = await reintentarEmision(params.id);
    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
