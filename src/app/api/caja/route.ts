import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requiereSesion } from '@/lib/auth/servidor';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

/**
 * CAJA DIARIA / CIERRE DE TURNO — reconcilia el efectivo físico contra lo
 * que el sistema espera: facturas cobradas en efectivo (formaPago="01")
 * menos gastos pagados en efectivo (formaPago="EFECTIVO"), desde el cierre
 * anterior. El `saldoInicial` de un nuevo período es el conteo del cierre
 * anterior (el cambio que se deja en la caja).
 */
async function calcularPeriodoActual() {
  const ultimoCierre = await prisma.cierreCaja.findFirst({ orderBy: { hasta: 'desc' } });
  const desde = ultimoCierre?.hasta ?? new Date(0);
  const hasta = new Date();
  const saldoInicial = ultimoCierre?.efectivoContado ?? 0;

  const [facturas, gastos] = await Promise.all([
    prisma.factura.findMany({
      where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false, formaPago: '01' },
      select: { importeTotal: true },
    }),
    prisma.gasto.findMany({
      where: { fecha: { gte: desde, lt: hasta }, formaPago: 'EFECTIVO' },
      select: { total: true },
    }),
  ]);

  const ingresosEfectivo = round2(facturas.reduce((a, f) => a + f.importeTotal, 0));
  const egresosEfectivo = round2(gastos.reduce((a, g) => a + g.total, 0));
  const efectivoEsperado = round2(saldoInicial + ingresosEfectivo - egresosEfectivo);

  return { desde, hasta, saldoInicial, ingresosEfectivo, egresosEfectivo, efectivoEsperado, nFacturas: facturas.length, ultimoCierre };
}

/** GET /api/caja — vista previa del período abierto (sin cerrar) + historial de cierres. */
export async function GET() {
  const [periodo, historial] = await Promise.all([
    calcularPeriodoActual(),
    prisma.cierreCaja.findMany({ orderBy: { fecha: 'desc' }, take: 60 }),
  ]);

  return NextResponse.json({
    periodoActual: {
      desde: periodo.desde,
      hasta: periodo.hasta,
      saldoInicial: periodo.saldoInicial,
      ingresosEfectivo: periodo.ingresosEfectivo,
      egresosEfectivo: periodo.egresosEfectivo,
      efectivoEsperado: periodo.efectivoEsperado,
      nFacturas: periodo.nFacturas,
    },
    historial,
  });
}

const schema = z.object({
  efectivoContado: z.number().min(0),
  notas: z.string().max(500).optional(),
});

/** POST /api/caja — cierra el turno: recalcula el período en el servidor (no confía en el cliente) y registra el conteo físico. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalle: parsed.error.flatten() }, { status: 400 });
  }
  const sesion = await requiereSesion();
  const { efectivoContado, notas } = parsed.data;
  const periodo = await calcularPeriodoActual();

  const cierre = await prisma.cierreCaja.create({
    data: {
      desde: periodo.desde,
      hasta: periodo.hasta,
      usuario: sesion.nombre,
      saldoInicial: periodo.saldoInicial,
      ingresosEfectivo: periodo.ingresosEfectivo,
      egresosEfectivo: periodo.egresosEfectivo,
      efectivoEsperado: periodo.efectivoEsperado,
      efectivoContado: round2(efectivoContado),
      diferencia: round2(efectivoContado - periodo.efectivoEsperado),
      nFacturas: periodo.nFacturas,
      notas: notas || null,
    },
  });

  return NextResponse.json(cierre, { status: 201 });
}
