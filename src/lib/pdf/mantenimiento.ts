/**
 * PDF DÚPLEX A4 de evidencia de mantenimiento/mejora — PAGINACIÓN DINÁMICA.
 *
 * Diseño dúplex (impresión a doble cara por el borde largo):
 *   Por cada grupo de hasta 6 fotos (3 filas × 2 columnas) se generan DOS
 *   páginas consecutivas:
 *     · Página de FOTOS (cara A): grilla de fotos.
 *     · Página de DESCRIPCIONES (cara B): las mismas celdas pero ESPEJADAS por
 *       columna, de modo que al voltear la hoja cada texto queda detrás de su
 *       foto. Se repite este par por cada bloque de 6 fotos ⇒ SIN límite de 8.
 *   Al final se añade una página con el detalle financiero y de personal.
 *
 * Motor: pdfmake (multi-página nativo). No requiere Puppeteer/Chromium.
 */
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import { fmtSri } from '@/lib/money';
import { fechaLarga, rangoFechas } from '@/lib/fechas';

const printer = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

export interface ItemCosto {
  concepto: string;
  tipo: 'MATERIAL' | 'MANO_OBRA';
  monto: number;
}

export interface FotoTrabajo {
  orden: number;
  fase: 'ANTES' | 'DESPUES' | string;
  imagen: string; // data URI
  descripcion: string;
}

export interface TrabajoPdf {
  titulo: string;
  descripcionGeneral?: string | null;
  area?: string | null; // etiqueta del área física ya resuelta
  tipo?: string | null; // DANO | MEJORA
  categoriaEtiqueta?: string | null; // "Agua / Plomería"
  categoriaColor?: string | null; // color hex de la categoría
  fecha: Date;
  fechaInicio?: Date | null;
  fechaFin?: Date | null;
  totalDias?: number | null;
  totalHoras?: number | null;
  tiempoInvertido?: string | null;
  responsable?: string | null;
  responsableTel?: string | null;
  supervisor?: string | null;
  supervisorTel?: string | null;
  numerosFactura?: string | null;
  inventarioConsumido?: string | null;
  materialSobrante?: string | null;
  costoTotal: number;
  items: ItemCosto[];
  fotos: FotoTrabajo[];
}

const COLUMNAS = 2;
const FOTOS_POR_PAGINA = 6; // 3 filas × 2 columnas por hoja A4

/** Trunca un texto para que la celda no rompa el A4. */
function recortar(s: string | null | undefined, n: number): string {
  const t = (s ?? '').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/** Agrupa una lista en sub-listas (páginas) de tamaño `n`. */
function enBloques<T>(items: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/** Agrupa en filas de `cols` columnas. */
function enFilas<T>(items: T[], cols: number): T[][] {
  const filas: T[][] = [];
  for (let i = 0; i < items.length; i += cols) filas.push(items.slice(i, i + cols));
  return filas;
}

export async function generarPdfMantenimiento(t: TrabajoPdf): Promise<Buffer> {
  // Orden estable: primero por fase (ANTES antes que DESPUES), luego por orden.
  const fotos = [...t.fotos].sort((a, b) => {
    if (a.fase !== b.fase) return a.fase === 'ANTES' ? -1 : 1;
    return a.orden - b.orden;
  });

  const contenido: Content[] = [];

  // ---------- Encabezado + costo total (primera página) ----------
  const tipoTxt = t.tipo === 'DANO' ? 'Reparación de daño' : 'Mejora';
  const colorCat = t.categoriaColor || '#0f766e';
  contenido.push({
    columns: [
      { text: t.titulo, bold: true, fontSize: 15, width: '*' },
      { text: fechaLarga(t.fecha), fontSize: 9, color: '#6b7280', alignment: 'right', width: 'auto', margin: [0, 4, 0, 0] },
    ],
  });
  // Etiqueta de categoría con su color (tag), junto al tipo de trabajo.
  contenido.push({
    columns: [
      { text: tipoTxt, fontSize: 9, color: '#6b7280', width: 'auto' },
      ...(t.categoriaEtiqueta
        ? [{ text: `  ●  ${t.categoriaEtiqueta}`, fontSize: 9, bold: true, color: colorCat, width: '*' as const }]
        : []),
    ],
    margin: [0, 2, 0, 0],
  });
  // Línea de color de la categoría bajo el encabezado.
  contenido.push({
    canvas: [{ type: 'rect', x: 0, y: 0, w: 531, h: 3, color: colorCat }],
    margin: [0, 4, 0, 0],
  });
  contenido.push({
    margin: [0, 10, 0, 10],
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: 'COSTO TOTAL DEL TRABAJO', fontSize: 9, color: '#6b7280', alignment: 'center' },
          { text: `$ ${fmtSri(t.costoTotal)}`, fontSize: 30, bold: true, alignment: 'center', color: '#0f766e', margin: [0, 2, 0, 0] },
        ],
        margin: [0, 8, 0, 8],
      }]],
    },
    layout: { hLineColor: () => '#0f766e', vLineColor: () => '#0f766e', hLineWidth: () => 1.2, vLineWidth: () => 1.2 },
  });

  // ---------- Páginas dúplex dinámicas: por cada bloque de 6 fotos ----------
  const bloques = enBloques(fotos, FOTOS_POR_PAGINA);
  bloques.forEach((bloque, idxBloque) => {
    const filas = enFilas(bloque, COLUMNAS);
    // Con 3 filas por página cabe cómodo; alto de foto fijo y seguro.
    const altoFoto = 150;

    // --- Cara A: grilla de fotos ---
    const cuerpoFotos: TableCell[][] = filas.map((fila) => {
      const celdas: TableCell[] = fila.map((f) => ({
        stack: [
          { text: `Foto ${f.orden + 1} · ${f.fase}`, fontSize: 8, bold: true, color: f.fase === 'ANTES' ? '#b45309' : '#0f766e' },
          { image: f.imagen, fit: [235, altoFoto] as [number, number], alignment: 'center', margin: [0, 3, 0, 0] as [number, number, number, number] },
        ],
        margin: [0, 4, 0, 4] as [number, number, number, number],
      }));
      while (celdas.length < COLUMNAS) celdas.push({ text: '' });
      return celdas;
    });

    contenido.push({
      text: idxBloque === 0 ? 'Evidencia fotográfica' : `Evidencia fotográfica (cont. ${idxBloque + 1})`,
      bold: true,
      fontSize: 10,
      margin: [0, idxBloque === 0 ? 4 : 0, 0, 4],
      pageBreak: idxBloque === 0 ? undefined : 'before',
    });
    contenido.push({
      table: { widths: Array(COLUMNAS).fill('*'), body: cuerpoFotos },
      layout: { hLineColor: () => '#e5e7eb', vLineColor: () => '#e5e7eb' },
    });

    // --- Cara B: descripciones ESPEJADAS (una página nueva) ---
    const cuerpoDesc: TableCell[][] = filas.map((fila) => {
      const celdas: TableCell[] = fila.map((f) => ({
        stack: [
          { text: `Foto ${f.orden + 1} · ${f.fase}`, bold: true, fontSize: 8.5, color: '#0f766e' },
          { text: recortar(f.descripcion, 200) || '(sin descripción)', fontSize: 8.5, margin: [0, 2, 0, 0] },
        ],
        margin: [4, 6, 4, 6] as [number, number, number, number],
      }));
      while (celdas.length < COLUMNAS) celdas.push({ text: '' });
      return celdas.reverse(); // ESPEJO por columna para el dúplex
    });

    contenido.push({ text: 'Descripción de cada foto', bold: true, fontSize: 11, pageBreak: 'before', margin: [0, 0, 0, 6] });
    contenido.push({
      table: { widths: Array(COLUMNAS).fill('*'), body: cuerpoDesc.length ? cuerpoDesc : [[{ text: '' }, { text: '' }]] },
      layout: { hLineColor: () => '#e5e7eb', vLineColor: () => '#e5e7eb' },
    });
  });

  // ---------- Página final: detalle financiero + personal ----------
  const materiales = t.items.filter((i) => i.tipo === 'MATERIAL');
  const manoObra = t.items.filter((i) => i.tipo === 'MANO_OBRA');
  const filaItem = (i: ItemCosto): TableCell[] => [
    { text: recortar(i.concepto, 46), fontSize: 8 },
    { text: i.tipo === 'MATERIAL' ? 'Material' : 'Mano de obra', fontSize: 8 },
    { text: `$ ${fmtSri(i.monto)}`, alignment: 'right', fontSize: 8 },
  ];
  const cuerpoTabla: TableCell[][] = [
    [
      { text: 'Concepto', bold: true, fontSize: 8, fillColor: '#f3f4f6' },
      { text: 'Tipo', bold: true, fontSize: 8, fillColor: '#f3f4f6' },
      { text: 'Monto', bold: true, fontSize: 8, fillColor: '#f3f4f6', alignment: 'right' },
    ],
    ...[...materiales, ...manoObra].map(filaItem),
    [
      { text: 'TOTAL', bold: true, fontSize: 9, colSpan: 2 },
      {},
      { text: `$ ${fmtSri(t.costoTotal)}`, bold: true, alignment: 'right', fontSize: 9 },
    ],
  ];

  const conTel = (nombre?: string | null, tel?: string | null) => {
    const n = recortar(nombre, 40);
    if (!n) return '—';
    return tel ? `${n} · ${tel}` : n;
  };
  const tiempoTxt = t.totalDias != null || t.totalHoras != null
    ? `${t.totalDias ?? 0} día(s) · ${t.totalHoras ?? 0} h`
    : recortar(t.tiempoInvertido, 40) || '—';
  const rangoTrabajoTxt = rangoFechas(t.fechaInicio, t.fechaFin) || '—';

  const infoPersonal: TableCell[][] = [
    [{ text: 'Área', bold: true, fontSize: 8 }, { text: recortar(t.area, 40) || 'General', fontSize: 8 }],
    [{ text: 'Periodo', bold: true, fontSize: 8 }, { text: rangoTrabajoTxt, fontSize: 8 }],
    [{ text: 'Tiempo', bold: true, fontSize: 8 }, { text: tiempoTxt, fontSize: 8 }],
    [{ text: 'Responsable', bold: true, fontSize: 8 }, { text: conTel(t.responsable, t.responsableTel), fontSize: 8 }],
    [{ text: 'Supervisor', bold: true, fontSize: 8 }, { text: conTel(t.supervisor, t.supervisorTel), fontSize: 8 }],
    [{ text: 'Nº factura(s)', bold: true, fontSize: 8 }, { text: recortar(t.numerosFactura, 40) || '—', fontSize: 8 }],
    [{ text: 'Inventario consumido', bold: true, fontSize: 8 }, { text: recortar(t.inventarioConsumido, 60) || '—', fontSize: 8 }],
    [{ text: 'Material sobrante', bold: true, fontSize: 8 }, { text: recortar(t.materialSobrante, 60) || '—', fontSize: 8 }],
  ];

  contenido.push({ text: 'Detalle financiero y de personal', bold: true, fontSize: 11, pageBreak: 'before', margin: [0, 0, 0, 6] });
  contenido.push({
    columns: [
      {
        width: '58%',
        table: { headerRows: 1, widths: ['*', 'auto', 'auto'], body: cuerpoTabla },
        layout: { hLineColor: () => '#d1d5db', vLineColor: () => '#d1d5db' },
      },
      {
        width: '42%',
        margin: [10, 0, 0, 0],
        table: { widths: ['auto', '*'], body: infoPersonal },
        layout: { hLineColor: () => '#e5e7eb', vLineColor: () => '#e5e7eb' },
      },
    ],
    columnGap: 8,
  });

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [32, 32, 32, 36],
    defaultStyle: { font: 'Helvetica', fontSize: 9 },
    content: contenido,
    footer: (page, total) => ({
      text: `Casa Mamá Emma · Evidencia de mantenimiento · Página ${page}/${total}`,
      alignment: 'center',
      fontSize: 7,
      color: '#9ca3af',
      margin: [0, 10, 0, 0],
    }),
  };

  return new Promise<Buffer>((resolve, reject) => {
    const pdf = printer.createPdfKitDocument(doc);
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.end();
  });
}
