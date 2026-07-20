import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { emitirFactura } from '@/lib/sri/procesoEmision';
import { validarIdentificacion, validarTelefono, TIPO_IDENTIFICACION } from '@/lib/sri/catalogos';

export const dynamic = 'force-dynamic';

/** GET /api/facturas?mes=2026-07 — listado (filtro mensual opcional) */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get('mes'); // "YYYY-MM"
  let where = {};
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split('-').map(Number);
    where = { fechaEmision: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } };
  }
  const facturas = await prisma.factura.findMany({
    where,
    include: { cliente: true, detalles: true },
    orderBy: { fechaEmision: 'desc' },
    take: 200,
  });
  return NextResponse.json(facturas);
}

const facturaSchema = z.object({
  habitacionIds: z.array(z.number().int()).min(1),
  modoPrecio: z.enum(['HABITACION', 'PERSONA', 'CASA_COMPLETA', 'AIRBNB']),
  // Capacidad máxima de la propiedad: 21 personas (el frontend pide confirmación
  // explícita para superarla; el backend permite hasta un tope duro razonable).
  huespedes: z.number().int().min(1).max(60),
  noches: z.number().int().min(1).max(365),
  // Fechas de la ESTADÍA (reserva), distintas de la fecha de emisión.
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  descuentoUsd: z.number().min(0).optional(),
  precioManualUsd: z.number().min(0).optional(),
  codigoIva: z.enum(['4', '8', '0']),
  formaPago: z.enum(['01', '20']),
  propina: z.number().min(0).optional(),
  precioAirbnbPersona: z.number().min(0).optional(),
  netoAirbnbUsd: z.number().min(0).optional(), // payout recibido → deriva el total
  totalAirbnbUsd: z.number().min(0).optional(), // total pagado en Airbnb → deriva el neto
  comisionAirbnb: z.number().min(0).max(99).optional(),
  // Plataforma de origen de la venta (marca el disclaimer Airbnb en el PDF).
  viaAirbnb: z.boolean().optional(),
  extras: z.array(z.object({ descripcion: z.string().min(1), valor: z.number().positive() })).optional(),
  cliente: z.object({
    tipoIdentificacion: z.enum(['04', '05', '06', '07', '08']),
    identificacion: z.string(),
    razonSocial: z.string(),
    direccion: z.string().optional(),
    // Email con dominio real (exige TLD: alguien@dominio.tld).
    email: z.string().email().refine((v) => /\.[a-z]{2,}$/i.test(v), 'El correo debe tener un dominio válido').optional().or(z.literal('')),
    // Teléfono: máx. 15 dígitos (estándar internacional E.164).
    telefono: z.string().max(20).refine((v) => (v.match(/\d/g) ?? []).length <= 15, 'El teléfono no puede tener más de 15 dígitos').optional().or(z.literal('')),
    nacionalidad: z.string().max(60).optional(),
    // CRM interno OPCIONAL (no va al SRI): alimenta el perfil demográfico.
    genero: z.enum(['MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERE_NO_DECIR']).optional(),
  }),
});

/** POST /api/facturas — emite la factura (XML -> firma -> SRI) */
export async function POST(req: Request) {
  const parsed = facturaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalle: parsed.error.flatten() }, { status: 400 });
  }
  const datos = parsed.data;

  // Validación de identificación con MENSAJE DESCRIPTIVO (misma lógica que el
  // frontend). Pasaporte alfanumérico; cédula/RUC numérico + módulo 10.
  const { tipoIdentificacion, identificacion } = datos.cliente;
  const vId = validarIdentificacion(tipoIdentificacion, identificacion);
  if (!vId.ok) {
    return NextResponse.json({ error: vId.error }, { status: 400 });
  }
  // Teléfono: solo números (si viene).
  const vTel = validarTelefono(datos.cliente.telefono ?? '');
  if (!vTel.ok) {
    return NextResponse.json({ error: vTel.error }, { status: 400 });
  }
  if (tipoIdentificacion !== TIPO_IDENTIFICACION.CONSUMIDOR_FINAL && !datos.cliente.razonSocial.trim()) {
    return NextResponse.json({ error: 'Ingrese el nombre / razón social del cliente' }, { status: 400 });
  }

  try {
    const resultado = await emitirFactura({
      ...datos,
      cliente: { ...datos.cliente, email: datos.cliente.email || undefined },
    });
    return NextResponse.json(resultado, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
