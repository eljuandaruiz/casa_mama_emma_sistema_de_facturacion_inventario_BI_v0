import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generarPdfMantenimiento, type ItemCosto } from '@/lib/pdf/mantenimiento';
import { etiquetaArea } from '@/lib/areas';
import { categoriaMantenimiento } from '@/lib/categoriasMantenimiento';

export const dynamic = 'force-dynamic';

/** GET /api/mantenimiento/:id/pdf — descarga el PDF dúplex A4 del trabajo. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const t = await prisma.trabajoMantenimiento.findUnique({
    where: { id },
    include: { fotos: { orderBy: { orden: 'asc' } } },
  });
  if (!t) return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 });

  let items: ItemCosto[] = [];
  try {
    items = JSON.parse(t.itemsCosto) as ItemCosto[];
  } catch {
    items = [];
  }

  const pdf = await generarPdfMantenimiento({
    titulo: t.titulo,
    descripcionGeneral: t.descripcionGeneral,
    area: etiquetaArea(t.area),
    tipo: t.tipo,
    categoriaEtiqueta: categoriaMantenimiento(t.categoria).etiqueta,
    categoriaColor: categoriaMantenimiento(t.categoria).color,
    fecha: t.fecha,
    fechaInicio: t.fechaInicio,
    fechaFin: t.fechaFin,
    totalDias: t.totalDias,
    totalHoras: t.totalHoras,
    tiempoInvertido: t.tiempoInvertido,
    responsable: t.responsable,
    responsableTel: t.responsableTel,
    supervisor: t.supervisor,
    supervisorTel: t.supervisorTel,
    numerosFactura: t.numerosFactura,
    inventarioConsumido: t.inventarioConsumido,
    materialSobrante: t.materialSobrante,
    costoTotal: t.costoTotal,
    items,
    fotos: t.fotos.map((f) => ({ orden: f.orden, fase: f.fase, imagen: f.imagen, descripcion: f.descripcion })),
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="mantenimiento-${t.id}.pdf"`,
    },
  });
}
