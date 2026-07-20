import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bi/facturas?pendientes=1 — facturas recientes con indicador de si
 * ya tienen perfil demográfico, para elegir cuál completar desde la vista BI.
 */
export async function GET(req: Request) {
  const soloPendientes = new URL(req.url).searchParams.get('pendientes') === '1';

  const facturas = await prisma.factura.findMany({
    where: { anulada: false, ...(soloPendientes ? { perfil: { is: null } } : {}) },
    include: { cliente: true, perfil: { select: { id: true } } },
    orderBy: { fechaEmision: 'desc' },
    take: 100,
  });

  return NextResponse.json(
    facturas.map((f) => ({
      id: f.id,
      numeroCompleto: f.numeroCompleto,
      fecha: f.fechaEmision,
      cliente: f.cliente.razonSocial,
      huespedes: f.huespedes,
      noches: f.noches,
      total: f.importeTotal,
      tienePerfil: f.perfil != null,
    })),
  );
}
