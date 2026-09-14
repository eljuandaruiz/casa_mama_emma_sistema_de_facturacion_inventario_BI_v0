import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

// @ts-expect-error -- vfs_fonts no trae tipos; asignación estándar del build de pdfmake para navegador.
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

export function generarPdfBlob(doc: TDocumentDefinitions): Promise<Blob> {
  return new Promise((resolve) => {
    pdfMake.createPdf(doc).getBlob((blob) => resolve(blob));
  });
}
