/**
 * EXPORTACIÓN DEL LIBRO MENSUAL a Excel (.xlsx) y CSV.
 *
 * Estructura pensada para conectarse a una hoja maestra de declaración:
 *  - Hoja "Ventas": una fila por factura con bases desglosadas por tarifa
 *    (columnas alineadas con los casilleros del Formulario 104 del SRI).
 *  - Hoja "Gastos": crédito tributario y gastos deducibles.
 *  - Hoja "Resumen Mensual": pivote año-mes listo para la declaración.
 */
import ExcelJS from 'exceljs';
import type { Factura, Cliente, Gasto } from '@prisma/client';

type FacturaConCliente = Factura & { cliente: Cliente };

const mes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const encabezado = (ws: ExcelJS.Worksheet) => {
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
};

export async function generarExcelLibro(
  facturas: FacturaConCliente[],
  gastos: Gasto[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Casa Mamá Emma - Sistema de Facturación';
  wb.created = new Date();

  // ================= HOJA VENTAS =================
  const wsV = wb.addWorksheet('Ventas');
  wsV.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Mes', key: 'mes', width: 9 },
    { header: 'No. Factura', key: 'numero', width: 20 },
    { header: 'Clave de Acceso', key: 'clave', width: 52 },
    { header: 'Estado SRI', key: 'estado', width: 15 },
    { header: 'Cliente', key: 'cliente', width: 30 },
    { header: 'Identificación', key: 'identificacion', width: 16 },
    { header: 'Huéspedes', key: 'huespedes', width: 10 },
    { header: 'Noches', key: 'noches', width: 8 },
    { header: 'Modo Precio', key: 'modo', width: 12 },
    { header: 'Base IVA 15%', key: 'base15', width: 13 },
    { header: 'Base IVA 8%', key: 'base8', width: 12 },
    { header: 'Base IVA 0%', key: 'base0', width: 12 },
    { header: 'Descuento', key: 'descuento', width: 11 },
    { header: 'IVA', key: 'iva', width: 10 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Forma de Pago', key: 'formaPago', width: 15 },
    { header: 'Anulada', key: 'anulada', width: 9 },
  ];
  for (const f of facturas) {
    wsV.addRow({
      fecha: f.fechaEmision,
      mes: mes(f.fechaEmision),
      numero: f.numeroCompleto,
      clave: f.claveAcceso,
      estado: f.estadoSri,
      cliente: f.cliente.razonSocial,
      identificacion: f.cliente.identificacion,
      huespedes: f.huespedes,
      noches: f.noches,
      modo: f.modoPrecio,
      base15: f.base15,
      base8: f.base8,
      base0: f.base0,
      descuento: f.totalDescuento,
      iva: f.valorIva,
      total: f.importeTotal,
      formaPago: f.formaPago === '01' ? 'Efectivo' : 'Transferencia',
      anulada: f.anulada ? 'SÍ' : 'NO',
    });
  }
  encabezado(wsV);
  wsV.getColumn('fecha').numFmt = 'dd/mm/yyyy';
  for (const c of ['base15', 'base8', 'base0', 'descuento', 'iva', 'total']) {
    wsV.getColumn(c).numFmt = '"$"#,##0.00';
  }

  // ================= HOJA GASTOS =================
  const wsG = wb.addWorksheet('Gastos');
  wsG.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Mes', key: 'mes', width: 9 },
    { header: 'Categoría', key: 'categoria', width: 20 },
    { header: 'Descripción', key: 'descripcion', width: 36 },
    { header: 'Proveedor', key: 'proveedor', width: 24 },
    { header: 'RUC Proveedor', key: 'ruc', width: 16 },
    { header: 'No. Comprobante', key: 'comprobante', width: 20 },
    { header: 'Subtotal', key: 'subtotal', width: 11 },
    { header: 'IVA', key: 'iva', width: 10 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Forma de Pago', key: 'formaPago', width: 14 },
    { header: 'Deducible', key: 'deducible', width: 10 },
  ];
  for (const g of gastos) {
    wsG.addRow({
      fecha: g.fecha,
      mes: mes(g.fecha),
      categoria: g.categoria,
      descripcion: g.descripcion,
      proveedor: g.proveedor ?? '',
      ruc: g.rucProveedor ?? '',
      comprobante: g.numeroComprobante ?? '',
      subtotal: g.subtotal,
      iva: g.iva,
      total: g.total,
      formaPago: g.formaPago,
      deducible: g.deducible ? 'SÍ' : 'NO',
    });
  }
  encabezado(wsG);
  wsG.getColumn('fecha').numFmt = 'dd/mm/yyyy';
  for (const c of ['subtotal', 'iva', 'total']) wsG.getColumn(c).numFmt = '"$"#,##0.00';

  // ================= HOJA RESUMEN MENSUAL =================
  const meses = new Map<
    string,
    { ventas15: number; ventas8: number; ventas0: number; ivaCobrado: number; nFacturas: number; gastos: number; ivaPagado: number }
  >();
  const celda = (k: string) => {
    if (!meses.has(k)) meses.set(k, { ventas15: 0, ventas8: 0, ventas0: 0, ivaCobrado: 0, nFacturas: 0, gastos: 0, ivaPagado: 0 });
    return meses.get(k)!;
  };
  for (const f of facturas) {
    if (f.anulada) continue;
    const m = celda(mes(f.fechaEmision));
    m.ventas15 += f.base15;
    m.ventas8 += f.base8;
    m.ventas0 += f.base0;
    m.ivaCobrado += f.valorIva;
    m.nFacturas += 1;
  }
  for (const g of gastos) {
    const m = celda(mes(g.fecha));
    m.gastos += g.subtotal;
    m.ivaPagado += g.iva;
  }

  const wsR = wb.addWorksheet('Resumen Mensual');
  wsR.columns = [
    { header: 'Mes', key: 'mes', width: 10 },
    { header: '# Facturas', key: 'n', width: 11 },
    { header: 'Ventas 15% (F104: 411)', key: 'v15', width: 20 },
    { header: 'Ventas 8%', key: 'v8', width: 13 },
    { header: 'Ventas 0% (F104: 413)', key: 'v0', width: 20 },
    { header: 'IVA Cobrado (F104: 421)', key: 'ivaC', width: 21 },
    { header: 'Compras/Gastos', key: 'gastos', width: 15 },
    { header: 'IVA Pagado (crédito)', key: 'ivaP', width: 19 },
    { header: 'IVA a Pagar (estimado)', key: 'ivaNeto', width: 20 },
    { header: 'Utilidad Bruta', key: 'utilidad', width: 15 },
  ];
  const claves = [...meses.keys()].sort();
  for (const k of claves) {
    const m = meses.get(k)!;
    const ventasTotales = m.ventas15 + m.ventas8 + m.ventas0;
    wsR.addRow({
      mes: k,
      n: m.nFacturas,
      v15: m.ventas15,
      v8: m.ventas8,
      v0: m.ventas0,
      ivaC: m.ivaCobrado,
      gastos: m.gastos,
      ivaP: m.ivaPagado,
      ivaNeto: Math.max(0, m.ivaCobrado - m.ivaPagado),
      utilidad: ventasTotales - m.gastos,
    });
  }
  encabezado(wsR);
  for (const c of ['v15', 'v8', 'v0', 'ivaC', 'gastos', 'ivaP', 'ivaNeto', 'utilidad']) {
    wsR.getColumn(c).numFmt = '"$"#,##0.00';
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** CSV plano (separador coma, UTF-8 con BOM para Excel en español). */
export function generarCsv(filas: (string | number)[][]): Buffer {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const texto = filas.map((f) => f.map(esc).join(',')).join('\r\n');
  return Buffer.from('﻿' + texto, 'utf8');
}

export function csvVentas(facturas: FacturaConCliente[]): Buffer {
  return generarCsv([
    ['Fecha', 'No. Factura', 'Clave de Acceso', 'Estado', 'Cliente', 'Identificación', 'Base 15%', 'Base 8%', 'Base 0%', 'Descuento', 'IVA', 'Total', 'Forma Pago'],
    ...facturas.map((f) => [
      f.fechaEmision.toISOString().slice(0, 10),
      f.numeroCompleto,
      f.claveAcceso,
      f.estadoSri,
      f.cliente.razonSocial,
      f.cliente.identificacion,
      f.base15,
      f.base8,
      f.base0,
      f.totalDescuento,
      f.valorIva,
      f.importeTotal,
      f.formaPago === '01' ? 'Efectivo' : 'Transferencia',
    ]),
  ]);
}

export function csvGastos(gastos: Gasto[]): Buffer {
  return generarCsv([
    ['Fecha', 'Categoría', 'Descripción', 'Proveedor', 'RUC', 'No. Comprobante', 'Subtotal', 'IVA', 'Total', 'Deducible'],
    ...gastos.map((g) => [
      g.fecha.toISOString().slice(0, 10),
      g.categoria,
      g.descripcion,
      g.proveedor ?? '',
      g.rucProveedor ?? '',
      g.numeroComprobante ?? '',
      g.subtotal,
      g.iva,
      g.total,
      g.deducible ? 'SÍ' : 'NO',
    ]),
  ]);
}
