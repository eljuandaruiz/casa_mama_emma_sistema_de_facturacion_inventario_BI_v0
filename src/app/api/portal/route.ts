import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { validarCedula, validarRuc, TIPO_IDENTIFICACION } from '@/lib/sri/catalogos';

export const dynamic = 'force-dynamic';

// Ruta PÚBLICA (el middleware la exceptúa): el huésped deja sus datos de
// facturación. No devuelve ni precios ni información interna.
const schema = z.object({
  nombre: z.string().trim().min(3, 'Ingresa tu nombre completo').max(120),
  tipoIdentificacion: z.enum(['05', '06', '04']),
  identificacion: z.string().trim().min(3).max(20),
  direccion: z.string().trim().max(200).optional().or(z.literal('')),
  // Email con dominio real (exige TLD) y teléfono máx. 15 dígitos (E.164).
  email: z.string().email('Correo inválido').refine((v) => /\.[a-z]{2,}$/i.test(v), 'El correo debe tener un dominio válido').optional().or(z.literal('')),
  telefono: z.string().trim().max(20).refine((v) => (v.match(/\d/g) ?? []).length <= 15, 'El teléfono no puede tener más de 15 dígitos').optional().or(z.literal('')),
  nacionalidad: z.string().trim().max(60).optional().or(z.literal('')),
  numeroHabitacion: z.coerce.number().int().min(2).max(7).optional(),
  mensaje: z.string().trim().max(300).optional().or(z.literal('')),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Validación de documento según tipo (cédula y RUC ecuatorianos; el
  // pasaporte es texto libre porque no tiene dígito verificador estándar).
  if (d.tipoIdentificacion === TIPO_IDENTIFICACION.CEDULA && !validarCedula(d.identificacion)) {
    return NextResponse.json({ error: 'La cédula no es válida' }, { status: 400 });
  }
  if (d.tipoIdentificacion === TIPO_IDENTIFICACION.RUC && !validarRuc(d.identificacion)) {
    return NextResponse.json({ error: 'El RUC no es válido' }, { status: 400 });
  }

  await prisma.solicitudHuesped.create({
    data: {
      nombre: d.nombre,
      tipoIdentificacion: d.tipoIdentificacion,
      identificacion: d.identificacion,
      direccion: d.direccion || null,
      email: d.email || null,
      telefono: d.telefono || null,
      nacionalidad: d.nacionalidad || null,
      numeroHabitacion: d.numeroHabitacion ?? null,
      mensaje: d.mensaje || null,
    },
  });

  // Respuesta mínima: solo confirmación (sin devolver el registro completo).
  return NextResponse.json({ ok: true }, { status: 201 });
}
