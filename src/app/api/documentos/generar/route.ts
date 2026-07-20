import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';
import { escribirHojaDocumento } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

/**
 * DOCUMENTOS AUTOMÁTICOS — genera reportes contables como pestañas del libro
 * de Google Sheets configurado (cuenta de servicio), con fórmulas de SUMA
 * evaluadas. Interconecta facturación (emitidas), gastos (recibidas) y el
 * crédito tributario en documentos listos para compartir con el contador.
 *
 * Tipos: VENTAS | GASTOS | CREDITO_TRIBUTARIO
 */
const schema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  tipo: z.enum(['VENTAS', 'GASTOS', 'CREDITO_TRIBUTARIO']),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const { mes, tipo } = parsed.data;
  const [y, m] = mes.split('-').map(Number);
  const desde = new Date(y, m - 1, 1);
  const hasta = new Date(y, m, 1);
  const f = (d: Date) => new Date(d).toLocaleDateString('es-EC');

  let nombreHoja = '';
  let filas: (string | number)[][] = [];

  if (tipo === 'VENTAS') {
    const facturas = await prisma.factura.findMany({
      where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false },
      include: { cliente: { select: { razonSocial: true, identificacion: true } } },
      orderBy: { fechaEmision: 'asc' },
    });
    nombreHoja = `Ventas-${mes}`;
    const datos = facturas.map((x) => [
      f(x.fechaEmision), x.numeroCompleto, x.cliente.razonSocial, x.cliente.identificacion,
      round2(x.subtotalSinImpuestos - x.totalDescuento), round2(x.valorIva), round2(x.importeTotal), x.estadoSri,
    ]);
    const ultima = 2 + datos.length; // encabezados en filas 1-2; datos desde la 3
    filas = [
      ['FACTURAS EMITIDAS', mes, '', '', '', '', '', ''],
      ['Fecha', 'Nº Factura', 'Cliente', 'Identificación', 'Base', 'IVA', 'Total', 'Estado SRI'],
      ...datos,
      ['', '', '', 'TOTALES:', `=SUM(E3:E${ultima})`, `=SUM(F3:F${ultima})`, `=SUM(G3:G${ultima})`, ''],
    ];
  } else if (tipo === 'GASTOS') {
    const gastos = await prisma.gasto.findMany({
      where: { fecha: { gte: desde, lt: hasta } },
      orderBy: { fecha: 'asc' },
    });
    nombreHoja = `Gastos-${mes}`;
    const datos = gastos.map((g) => [
      f(g.fecha), g.proveedor ?? '', g.rucProveedor ?? '', g.numeroComprobante ?? '', g.categoria,
      round2(g.subtotal), round2(g.iva), round2(g.total), g.deducible ? 'SÍ' : 'NO',
    ]);
    const ultima = 2 + datos.length;
    filas = [
      ['FACTURAS RECIBIDAS / GASTOS', mes, '', '', '', '', '', '', ''],
      ['Fecha', 'Proveedor', 'RUC', 'Comprobante', 'Categoría', 'Subtotal', 'IVA', 'Total', 'Deducible'],
      ...datos,
      ['', '', '', '', 'TOTALES:', `=SUM(F3:F${ultima})`, `=SUM(G3:G${ultima})`, `=SUM(H3:H${ultima})`, ''],
    ];
  } else {
    // CRÉDITO TRIBUTARIO: IVA cobrado en ventas − IVA pagado en compras deducibles.
    const [facturas, gastos] = await Promise.all([
      prisma.factura.findMany({ where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false }, select: { valorIva: true } }),
      prisma.gasto.findMany({ where: { fecha: { gte: desde, lt: hasta }, deducible: true }, select: { iva: true } }),
    ]);
    const ivaVentas = round2(facturas.reduce((a, x) => a + x.valorIva, 0));
    const ivaCompras = round2(gastos.reduce((a, g) => a + g.iva, 0));
    nombreHoja = `CreditoTributario-${mes}`;
    filas = [
      ['CRÉDITO TRIBUTARIO IVA', mes, ''],
      ['Concepto', 'Valor USD', 'Referencia F.104'],
      ['IVA cobrado en ventas', ivaVentas, 'Casillero 421/423'],
      ['IVA pagado en compras deducibles (crédito)', ivaCompras, 'Casillero 521'],
      ['IVA A PAGAR (o saldo a favor si es negativo)', '=B3-B4', ''],
      ['', '', ''],
      ['Nota: estimación de apoyo. La declaración oficial (F.104) la valida tu contador.', '', ''],
    ];
  }

  const r = await escribirHojaDocumento(nombreHoja, filas);
  if (!r.ok) return NextResponse.json({ error: r.motivo }, { status: 502 });
  return NextResponse.json({ ok: true, hoja: nombreHoja, url: r.url });
}
