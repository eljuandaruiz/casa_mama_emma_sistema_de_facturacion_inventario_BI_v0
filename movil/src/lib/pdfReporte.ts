import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Gasto, Ingreso, Mantenimiento } from './db';
import { fmtUsd } from './dinero';
import { generarPdfBlob } from './pdfBase';

export async function generarPdfReporte(
  desde: string,
  hasta: string,
  gastos: Gasto[],
  ingresos: Ingreso[],
  mantenimientos: Mantenimiento[],
): Promise<Blob> {
  const totalIngresos = ingresos.reduce((a, i) => a + i.monto, 0);
  const totalGastos = gastos.reduce((a, g) => a + g.monto, 0);
  const totalMantenimiento = mantenimientos.reduce((a, m) => a + m.costoMateriales + m.costoManoObra, 0);
  const resultado = totalIngresos - totalGastos - totalMantenimiento;

  const doc: TDocumentDefinitions = {
    pageMargins: [40, 50, 40, 40],
    content: [
      { text: 'Casa Mamá Emma', fontSize: 10, color: '#64748b' },
      { text: 'Reporte financiero', fontSize: 20, bold: true, margin: [0, 2, 0, 2] },
      { text: `${desde} a ${hasta}`, fontSize: 10, color: '#64748b', margin: [0, 0, 0, 14] },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            ['Ingresos', fmtUsd(totalIngresos)],
            ['Gastos', fmtUsd(totalGastos)],
            ['Mantenimiento', fmtUsd(totalMantenimiento)],
            [{ text: 'Resultado', bold: true }, { text: fmtUsd(resultado), bold: true }],
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 16],
      },
      { text: 'Ingresos', bold: true, fontSize: 12, margin: [0, 0, 0, 6] },
      {
        table: {
          widths: ['auto', 'auto', '*', 'auto'],
          body: [
            [{ text: 'Fecha', bold: true }, { text: 'Canal', bold: true }, { text: 'Notas', bold: true }, { text: 'Monto', bold: true }],
            ...ingresos.map((i) => [i.fecha, i.canal, i.notas || '-', fmtUsd(i.monto)]),
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 16],
        fontSize: 9,
      },
      { text: 'Gastos', bold: true, fontSize: 12, margin: [0, 0, 0, 6] },
      {
        table: {
          widths: ['auto', '*', '*', 'auto'],
          body: [
            [{ text: 'Fecha', bold: true }, { text: 'Categoría', bold: true }, { text: 'Descripción', bold: true }, { text: 'Monto', bold: true }],
            ...gastos.map((g) => [g.fecha, g.categoria, g.descripcion, fmtUsd(g.monto)]),
          ],
        },
        layout: 'lightHorizontalLines',
        fontSize: 9,
      },
    ],
  };
  return generarPdfBlob(doc);
}
