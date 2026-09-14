import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Mantenimiento } from './db';
import { fmtUsd } from './dinero';
import { generarPdfBlob } from './pdfBase';

export async function generarPdfMantenimiento(m: Mantenimiento): Promise<Blob> {
  const fotos: Content[] = [];
  for (let i = 0; i < m.fotos.length; i += 2) {
    const par = m.fotos.slice(i, i + 2);
    fotos.push({
      columns: par.map((f) => ({
        width: '*',
        stack: [
          { image: f.imagen, width: 220, alignment: 'center' },
          { text: f.descripcion || ' ', fontSize: 9, alignment: 'center', margin: [0, 4, 0, 12] },
        ],
      })) as Content[],
      columnGap: 10,
    });
  }

  const total = m.costoMateriales + m.costoManoObra;

  const doc: TDocumentDefinitions = {
    pageMargins: [40, 50, 40, 40],
    content: [
      { text: 'Casa Mamá Emma', fontSize: 10, color: '#64748b' },
      { text: m.titulo, fontSize: 20, bold: true, margin: [0, 2, 0, 8] },
      {
        columns: [
          { text: `Área: ${m.area}`, fontSize: 10 },
          { text: `Fecha: ${m.fecha}`, fontSize: 10, alignment: 'right' },
        ],
        margin: [0, 0, 0, 12],
      },
      { text: 'Descripción', bold: true, fontSize: 11, margin: [0, 0, 0, 4] },
      { text: m.descripcion || 'Sin descripción.', fontSize: 10, margin: [0, 0, 0, 16] },
      ...(fotos.length ? [{ text: 'Fotos', bold: true, fontSize: 11, margin: [0, 0, 0, 6] } as Content, ...fotos] : []),
      { text: 'Costos', bold: true, fontSize: 11, margin: [0, 8, 0, 6] },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            ['Materiales', fmtUsd(m.costoMateriales)],
            ['Mano de obra', fmtUsd(m.costoManoObra)],
            [{ text: 'Total', bold: true }, { text: fmtUsd(total), bold: true }],
          ],
        },
        layout: 'lightHorizontalLines',
      },
    ],
  };
  return generarPdfBlob(doc);
}
