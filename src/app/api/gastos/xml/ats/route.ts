import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EMISOR } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** Escapado XML básico. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * GET /api/gastos/xml/ats?mes=2026-07 — exporta una estructura TIPO ATS
 * (Anexo Transaccional Simplificado) simplificada con las compras del mes.
 *
 * ⚠️ IMPORTANTE (léelo antes de usarlo): el ATS oficial del SRI tiene un XSD
 * mucho más extenso (sustento tributario, retenciones, forma de pago,
 * partes relacionadas, etc.). El SRI NO ofrece una API para subir gastos
 * directo a tu declaración — solo existe el aplicativo DIMM Formularios /
 * ATS oficial, donde se digita o importa. Esta exportación es una
 * ESTRUCTURA DE REFERENCIA con los campos que si tenemos (RUC, comprobante,
 * fecha, base imponible, IVA) para AGILIZAR la transcripción manual — no
 * está garantizado que valide contra el XSD oficial del SRI tal cual.
 */
export async function GET(req: Request) {
  const mes = new URL(req.url).searchParams.get('mes') ?? new Date().toISOString().slice(0, 7);
  const [y, m] = mes.split('-').map(Number);
  const desde = new Date(y, m - 1, 1);
  const hasta = new Date(y, m, 1);

  const gastos = await prisma.gasto.findMany({
    where: { fecha: { gte: desde, lt: hasta }, deducible: true },
    orderBy: { fecha: 'asc' },
  });

  const detalleCompras = gastos
    .map((g) => {
      const [estab, ptoEmi, sec] = (g.numeroComprobante ?? '001-001-000000001').split('-');
      return (
        '<detalleCompras>' +
        `<codSustento>01</codSustento>` + // 01 = crédito tributario para declaración de IVA (referencia)
        `<tpIdProv>01</tpIdProv>` + // 01 = RUC
        `<idProv>${esc(g.rucProveedor ?? '')}</idProv>` +
        `<tipoComprobante>01</tipoComprobante>` + // 01 = factura
        `<parteRel>NO</parteRel>` +
        `<fechaRegistro>${new Date(g.fecha).toLocaleDateString('es-EC')}</fechaRegistro>` +
        `<establecimiento>${esc(estab ?? '001')}</establecimiento>` +
        `<puntoEmision>${esc(ptoEmi ?? '001')}</puntoEmision>` +
        `<secuencial>${esc(sec ?? '000000001')}</secuencial>` +
        `<fechaEmision>${new Date(g.fecha).toLocaleDateString('es-EC')}</fechaEmision>` +
        `<baseNoGraIva>0.00</baseNoGraIva>` +
        `<baseImponible>${g.subtotal.toFixed(2)}</baseImponible>` +
        `<baseImpGrav>0.00</baseImpGrav>` +
        `<montoIce>0.00</montoIce>` +
        `<montoIva>${g.iva.toFixed(2)}</montoIva>` +
        `<valorRetBienes>0.00</valorRetBienes>` +
        `<valorRetServicios>0.00</valorRetServicios>` +
        `<valorRetRenta>0.00</valorRetRenta>` +
        `<categoria>${esc(g.categoria)}</categoria>` + // extra: no es parte del XSD oficial
        `<proveedor>${esc(g.proveedor ?? '')}</proveedor>` + // extra: no es parte del XSD oficial
        '</detalleCompras>'
      );
    })
    .join('');

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<!-- Estructura de REFERENCIA simplificada, no el XSD oficial del ATS del SRI. -->' +
    '<iva>' +
    `<ruc>${esc(EMISOR.ruc)}</ruc>` +
    `<periodo>${mes}</periodo>` +
    '<compras>' +
    detalleCompras +
    '</compras>' +
    '</iva>';

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="ats-referencia-${mes}.xml"`,
    },
  });
}
