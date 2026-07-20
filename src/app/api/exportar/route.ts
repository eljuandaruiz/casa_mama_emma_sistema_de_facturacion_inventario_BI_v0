import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generarExcelLibro, csvVentas, csvGastos } from '@/lib/export/excel';

export const dynamic = 'force-dynamic';

/**
 * GET /api/exportar?formato=xlsx|csv&tipo=ventas|gastos&desde=2026-01-01&hasta=2026-12-31
 * - xlsx: libro completo (Ventas + Gastos + Resumen Mensual para el F104)
 * - csv:  archivo plano por tipo (para sincronizar con la hoja maestra)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const formato = searchParams.get('formato') ?? 'xlsx';
  const tipo = searchParams.get('tipo') ?? 'ventas';
  const desde = searchParams.get('desde') ? new Date(searchParams.get('desde')!) : new Date(2000, 0, 1);
  const hastaParam = searchParams.get('hasta') ? new Date(searchParams.get('hasta')!) : new Date(2100, 0, 1);
  // incluir el día "hasta" completo
  const hasta = new Date(hastaParam.getTime() + 24 * 60 * 60 * 1000);

  const [facturas, gastos] = await Promise.all([
    prisma.factura.findMany({
      where: { fechaEmision: { gte: desde, lt: hasta } },
      include: { cliente: true },
      orderBy: { fechaEmision: 'asc' },
    }),
    prisma.gasto.findMany({ where: { fecha: { gte: desde, lt: hasta } }, orderBy: { fecha: 'asc' } }),
  ]);

  const hoy = new Date().toISOString().slice(0, 10);

  if (formato === 'csv') {
    const buffer = tipo === 'gastos' ? csvGastos(gastos) : csvVentas(facturas);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${tipo}-casa-mama-emma-${hoy}.csv"`,
      },
    });
  }

  const buffer = await generarExcelLibro(facturas, gastos);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="libro-casa-mama-emma-${hoy}.xlsx"`,
    },
  });
}
