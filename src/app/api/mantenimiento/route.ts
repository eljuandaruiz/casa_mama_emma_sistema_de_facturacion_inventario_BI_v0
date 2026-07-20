import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

/** GET /api/mantenimiento — lista trabajos (sin las imágenes, para la lista). */
export async function GET() {
  const trabajos = await prisma.trabajoMantenimiento.findMany({
    orderBy: { fecha: 'desc' },
    take: 100,
    include: { _count: { select: { fotos: true } } },
  });
  return NextResponse.json(
    trabajos.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      fecha: t.fecha,
      categoria: t.categoria,
      tipo: t.tipo,
      costoTotal: t.costoTotal,
      responsable: t.responsable,
      nFotos: t._count.fotos,
    })),
  );
}

const itemSchema = z.object({
  concepto: z.string().trim().min(1),
  tipo: z.enum(['MATERIAL', 'MANO_OBRA']),
  monto: z.coerce.number().min(0),
});

const fotoSchema = z.object({
  orden: z.number().int().min(0), // sin límite superior (paginación dinámica)
  fase: z.enum(['ANTES', 'DESPUES']).default('ANTES'),
  imagen: z.string().startsWith('data:image/'), // data URI
  descripcion: z.string().max(500).optional().default(''),
});

// Material del inventario usado en el trabajo (para descontar del stock).
const materialUsadoSchema = z.object({
  articuloId: z.number().int(),
  cantidad: z.coerce.number().positive(),
});

const schema = z.object({
  titulo: z.string().trim().min(3).max(120),
  descripcionGeneral: z.string().max(1000).optional(),
  area: z.string().max(20).optional(),
  categoria: z.enum(['AGUA_PLOMERIA', 'AGUA_CALIENTE', 'ELECTRICO', 'DRENAJE', 'GENERAL']).default('GENERAL'),
  tipo: z.enum(['DANO', 'MEJORA']).default('MEJORA'),
  fecha: z.string().optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  totalDias: z.coerce.number().int().min(0).optional(),
  totalHoras: z.coerce.number().min(0).optional(),
  tiempoInvertido: z.string().max(60).optional(),
  responsable: z.string().max(80).optional(),
  responsableTel: z.string().max(30).optional(),
  supervisor: z.string().max(80).optional(),
  supervisorTel: z.string().max(30).optional(),
  numerosFactura: z.string().max(200).optional(),
  inventarioConsumido: z.string().max(300).optional(),
  materialSobrante: z.string().max(300).optional(),
  items: z.array(itemSchema).max(80).default([]),
  // Sin límite de 8 fotos: la paginación del PDF es dinámica.
  fotos: z.array(fotoSchema).min(1, 'Sube al menos una foto').max(40),
  // Materiales del inventario consumidos por el trabajo (se descuentan del stock).
  materialesUsados: z.array(materialUsadoSchema).max(40).optional(),
});

/** POST /api/mantenimiento — crea un trabajo con sus fotos y costos. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const costoTotal = round2(d.items.reduce((a, i) => a + i.monto, 0));

  const trabajo = await prisma.trabajoMantenimiento.create({
    data: {
      titulo: d.titulo,
      descripcionGeneral: d.descripcionGeneral || null,
      area: d.area || null,
      categoria: d.categoria,
      tipo: d.tipo,
      fecha: d.fecha ? new Date(d.fecha) : new Date(),
      fechaInicio: d.fechaInicio ? new Date(d.fechaInicio) : null,
      fechaFin: d.fechaFin ? new Date(d.fechaFin) : null,
      totalDias: d.totalDias ?? null,
      totalHoras: d.totalHoras ?? null,
      tiempoInvertido: d.tiempoInvertido || null,
      responsable: d.responsable || null,
      responsableTel: d.responsableTel || null,
      supervisor: d.supervisor || null,
      supervisorTel: d.supervisorTel || null,
      numerosFactura: d.numerosFactura || null,
      inventarioConsumido: d.inventarioConsumido || null,
      materialSobrante: d.materialSobrante || null,
      itemsCosto: JSON.stringify(d.items),
      costoTotal,
      fotos: {
        create: d.fotos.map((f) => ({
          orden: f.orden,
          fase: f.fase,
          imagen: f.imagen,
          descripcion: f.descripcion ?? '',
        })),
      },
    },
    select: { id: true },
  });

  // ---------- Sync de inventario: descontar materiales usados del stock ----------
  // Transaccional por artículo; si el stock no alcanza, no baja de 0.
  for (const mat of d.materialesUsados ?? []) {
    try {
      await prisma.$transaction(async (tx) => {
        const art = await tx.articuloInventario.findUniqueOrThrow({ where: { id: mat.articuloId } });
        const nuevoStock = Math.max(0, round2(art.stock - mat.cantidad));
        await tx.articuloInventario.update({ where: { id: mat.articuloId }, data: { stock: nuevoStock } });
        await tx.movimientoInventario.create({
          data: {
            articuloId: mat.articuloId,
            tipo: 'SALIDA',
            cantidad: mat.cantidad,
            motivo: `Mantenimiento: ${d.titulo}`,
            stockResultante: nuevoStock,
          },
        });
      });
    } catch {
      // Un material inexistente no debe abortar el guardado del trabajo.
    }
  }

  // Auto-guarda los contactos usados para reutilizarlos (upsert por nombre).
  const guardarContacto = async (nombre?: string, tel?: string, oficio?: string) => {
    if (!nombre?.trim()) return;
    const existe = await prisma.contacto.findFirst({ where: { nombre: nombre.trim() } });
    if (existe) {
      if ((tel && tel !== existe.telefono) || (oficio && oficio !== existe.oficio)) {
        await prisma.contacto.update({
          where: { id: existe.id },
          data: { telefono: tel || existe.telefono, oficio: oficio || existe.oficio },
        });
      }
    } else {
      await prisma.contacto.create({ data: { nombre: nombre.trim(), telefono: tel || null, oficio: oficio || null } });
    }
  };
  await guardarContacto(d.responsable, d.responsableTel, 'Responsable');
  await guardarContacto(d.supervisor, d.supervisorTel, 'Supervisor');

  return NextResponse.json({ id: trabajo.id, costoTotal }, { status: 201 });
}
