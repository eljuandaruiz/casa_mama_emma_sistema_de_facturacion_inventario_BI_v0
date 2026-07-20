/**
 * Siembra inicial: 6 habitaciones de Casa Mamá Emma con su configuración
 * real de camas. Capacidad = 2×matrimonial + 1×simple + 2×litera.
 *
 * ⚠️ PRECIOS: son valores de ejemplo. Edítalos aquí antes de sembrar
 * o después desde la pantalla /ajustes (se guardan en la base de datos).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const capacidad = (m: number, s: number, l: number) => 2 * m + s + 2 * l;

const HABITACIONES = [
  { numero: 2, m: 1, s: 0, l: 0, precioHabitacion: 30, precioPersona: 15, grupo: null,   camas: '1 cama matrimonial' },
  { numero: 3, m: 1, s: 0, l: 0, precioHabitacion: 30, precioPersona: 15, grupo: '3-4',  camas: '1 cama matrimonial · espacio compartido con Hab. 4' },
  { numero: 4, m: 1, s: 1, l: 2, precioHabitacion: 60, precioPersona: 15, grupo: '3-4',  camas: '1 matrimonial, 1 simple, 2 literas · espacio compartido con Hab. 3' },
  { numero: 5, m: 1, s: 1, l: 0, precioHabitacion: 40, precioPersona: 15, grupo: null,   camas: '1 matrimonial, 1 simple' },
  { numero: 6, m: 1, s: 0, l: 0, precioHabitacion: 30, precioPersona: 15, grupo: null,   camas: '1 cama matrimonial' },
  { numero: 7, m: 1, s: 1, l: 1, precioHabitacion: 50, precioPersona: 15, grupo: null,   camas: '1 matrimonial, 1 simple, 1 litera' },
];

async function main() {
  for (const h of HABITACIONES) {
    await prisma.habitacion.upsert({
      where: { numero: h.numero },
      update: {},
      create: {
        numero: h.numero,
        nombre: `Habitación ${h.numero}`,
        descripcionCamas: h.camas,
        camasMatrimonial: h.m,
        camasSimple: h.s,
        camasLitera: h.l,
        capacidad: capacidad(h.m, h.s, h.l),
        precioHabitacion: h.precioHabitacion,
        precioPersona: h.precioPersona,
        grupoCompartido: h.grupo,
      },
    });
  }

  // Cliente genérico "Consumidor Final" (tabla 6 SRI: tipo 07, id 13 nueves)
  await prisma.cliente.upsert({
    where: { identificacion: '9999999999999' },
    update: {},
    create: {
      tipoIdentificacion: '07',
      identificacion: '9999999999999',
      razonSocial: 'CONSUMIDOR FINAL',
    },
  });

  // Secuencial inicial del punto de emisión 001-001 (arranca en 0 => primera factura = 000000001)
  await prisma.secuencial.upsert({
    where: {
      establecimiento_puntoEmision_tipoComprobante: {
        establecimiento: process.env.SRI_ESTABLECIMIENTO ?? '001',
        puntoEmision: process.env.SRI_PUNTO_EMISION ?? '001',
        tipoComprobante: '01',
      },
    },
    update: {},
    create: {
      establecimiento: process.env.SRI_ESTABLECIMIENTO ?? '001',
      puntoEmision: process.env.SRI_PUNTO_EMISION ?? '001',
      tipoComprobante: '01',
      ultimo: 0,
    },
  });

  // Configuración editable desde /ajustes
  await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      dirMatriz: process.env.SRI_DIR_MATRIZ ?? 'Baños de Agua Santa, Tungurahua, Ecuador',
      dirEstablecimiento: process.env.SRI_DIR_ESTABLECIMIENTO ?? 'Baños de Agua Santa, Tungurahua, Ecuador',
      obligadoContabilidad: process.env.SRI_OBLIGADO_CONTABILIDAD ?? 'NO',
      leyendaRide: 'Gracias por su visita a Casa Mamá Emma',
    },
  });

  // Usuarios iniciales para los TRES roles (RBAC). El admin toma sus datos de
  // .env; el facturador y operaciones usan contraseñas por defecto a cambiar.
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@casamamaema.com').toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD ?? 'CambiarClave123';
  // Login por USUARIO (username). Cada rol tiene su usuario de prueba.
  const usuariosBase: { usuario: string; email: string; nombre: string; rol: string; pass: string }[] = [
    { usuario: 'admin', email: adminEmail, nombre: 'Administrador', rol: 'ADMIN', pass: adminPass },
    { usuario: 'recepcion', email: 'facturador@casamamaema.com', nombre: 'Recepción (Facturador)', rol: 'FACTURADOR', pass: 'Recepcion123' },
    { usuario: 'operaciones', email: 'operaciones@casamamaema.com', nombre: 'Operaciones', rol: 'OPERACIONES', pass: 'Operaciones123' },
  ];
  for (const u of usuariosBase) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      // update: reencuadra usuarios de esquemas anteriores y fija el usuario.
      update: { rol: u.rol, usuario: u.usuario },
      create: {
        usuario: u.usuario,
        email: u.email,
        nombre: u.nombre,
        passwordHash: await bcrypt.hash(u.pass, 10),
        rol: u.rol,
        activo: true,
      },
    });
  }

  // Inventario base típico (solo si está vacío). Incluye categoría, icono y
  // VALOR UNITARIO monetario (para el cálculo de costos por estadía).
  const nArticulos = await prisma.articuloInventario.count();
  if (nArticulos === 0) {
    await prisma.articuloInventario.createMany({
      data: [
        { nombre: 'Sábanas (juego)', categoria: 'ROPA_CAMA', unidad: 'juego', stock: 20, stockMinimo: 8, valorUnitario: 12, icono: 'bed' },
        { nombre: 'Cobijas', categoria: 'ROPA_CAMA', unidad: 'unidad', stock: 15, stockMinimo: 6, valorUnitario: 15, icono: 'bed' },
        { nombre: 'Almohadas', categoria: 'ROPA_CAMA', unidad: 'unidad', stock: 18, stockMinimo: 8, valorUnitario: 6, icono: 'bed' },
        { nombre: 'Toallas de baño', categoria: 'ROPA_CAMA', unidad: 'unidad', stock: 22, stockMinimo: 10, valorUnitario: 5, icono: 'bed' },
        // Precios REALES de amenities (dados por el negocio, editables en /inventario):
        { nombre: 'Jabón de tocador', categoria: 'AMENIDADES', unidad: 'unidad', stock: 30, stockMinimo: 12, valorUnitario: 0.15, icono: 'sparkles' },
        { nombre: 'Jabón líquido (dosis)', categoria: 'AMENIDADES', unidad: 'unidad', stock: 30, stockMinimo: 12, valorUnitario: 0.15, icono: 'sparkles' },
        { nombre: 'Champú (sachet)', categoria: 'AMENIDADES', unidad: 'unidad', stock: 25, stockMinimo: 10, valorUnitario: 0.3, icono: 'sparkles' },
        { nombre: 'Botella de agua', categoria: 'AMENIDADES', unidad: 'unidad', stock: 24, stockMinimo: 12, valorUnitario: 0.25, icono: 'sparkles' },
        { nombre: 'Papel higiénico', categoria: 'AMENIDADES', unidad: 'rollo', stock: 40, stockMinimo: 15, valorUnitario: 0.4, icono: 'sparkles' },
        { nombre: 'Detergente', categoria: 'LIMPIEZA', unidad: 'litro', stock: 10, stockMinimo: 4, valorUnitario: 2, icono: 'spray-can' },
        { nombre: 'Desinfectante', categoria: 'LIMPIEZA', unidad: 'litro', stock: 8, stockMinimo: 3, valorUnitario: 2.5, icono: 'spray-can' },
        { nombre: 'Fundas de basura', categoria: 'LIMPIEZA', unidad: 'unidad', stock: 100, stockMinimo: 30, valorUnitario: 0.1, icono: 'spray-can' },
        { nombre: 'Foco LED', categoria: 'ILUMINACION_CABLEADO', unidad: 'unidad', stock: 15, stockMinimo: 5, valorUnitario: 2.5, icono: 'lightbulb' },
        { nombre: 'Café', categoria: 'COCINA_UTENSILIOS', unidad: 'unidad', stock: 12, stockMinimo: 4, valorUnitario: 0.3, icono: 'utensils' },
      ],
    });

    // Consumibles estándar por estadía en CUALQUIER habitación (numeroHabitacion=0).
    // Se descuentan del inventario al facturar y su costo entra en el margen.
    const jabon = await prisma.articuloInventario.findFirst({ where: { nombre: 'Jabón de tocador' } });
    const jabonLiquido = await prisma.articuloInventario.findFirst({ where: { nombre: 'Jabón líquido (dosis)' } });
    const champu = await prisma.articuloInventario.findFirst({ where: { nombre: 'Champú (sachet)' } });
    const agua = await prisma.articuloInventario.findFirst({ where: { nombre: 'Botella de agua' } });
    const papel = await prisma.articuloInventario.findFirst({ where: { nombre: 'Papel higiénico' } });
    const consumos = [
      { art: jabon, cant: 2 },
      { art: jabonLiquido, cant: 1 },
      { art: champu, cant: 1 },
      { art: agua, cant: 1 },
      { art: papel, cant: 1 },
    ];
    for (const c of consumos) {
      if (c.art) {
        await prisma.consumibleHabitacion.create({
          data: { numeroHabitacion: 0, articuloId: c.art.id, cantidad: c.cant },
        });
      }
    }
  }

  // Obligaciones tributarias típicas (solo si está vacío).
  // El día de vencimiento de las declaraciones depende del NOVENO DÍGITO del
  // RUC. Para el RUC 1805034426001 el noveno dígito es 2 => día 12.
  // Tabla SRI (noveno dígito -> día): 1→10, 2→12, 3→14, 4→16, 5→18, 6→20,
  // 7→22, 8→24, 9→26, 0→28.
  const DIA_POR_NOVENO_DIGITO: Record<string, number> = {
    '1': 10, '2': 12, '3': 14, '4': 16, '5': 18,
    '6': 20, '7': 22, '8': 24, '9': 26, '0': 28,
  };
  const ruc = process.env.SRI_RUC ?? '1805034426001';
  const novenoDigito = ruc.charAt(8); // 0-indexado: posición 8 = 9º dígito
  const diaVencimiento = DIA_POR_NOVENO_DIGITO[novenoDigito] ?? 12;

  const nOblig = await prisma.obligacion.count();
  if (nOblig === 0) {
    const anio = new Date().getFullYear();
    await prisma.obligacion.createMany({
      data: [
        {
          nombre: 'Declaración IVA (Formulario 104)',
          tipo: 'IMPUESTO',
          entidad: 'SRI',
          recurrencia: 'MENSUAL',
          // Día según el noveno dígito del RUC (aquí día 12 para dígito 2).
          proximoVencimiento: new Date(anio, new Date().getMonth(), diaVencimiento),
          notas: `Vence el día ${diaVencimiento} (noveno dígito del RUC = ${novenoDigito}).`,
        },
        {
          nombre: 'Patente municipal',
          tipo: 'MUNICIPAL',
          entidad: 'GAD Municipal Baños de Agua Santa',
          recurrencia: 'ANUAL',
          proximoVencimiento: new Date(anio, 2, 31), // ~marzo
          notas: 'Pago anual de la patente en el municipio de Baños.',
        },
        {
          nombre: 'Permiso de funcionamiento (Bomberos)',
          tipo: 'PERMISO',
          entidad: 'Cuerpo de Bomberos Baños',
          recurrencia: 'ANUAL',
          proximoVencimiento: new Date(anio, 11, 31),
        },
        {
          nombre: 'Impuesto a la Renta (Formulario 102A)',
          tipo: 'IMPUESTO',
          entidad: 'SRI',
          recurrencia: 'ANUAL',
          proximoVencimiento: new Date(anio, 2, 28), // marzo (personas naturales)
        },
        {
          nombre: 'Tasa de turismo / LUAF',
          tipo: 'MUNICIPAL',
          entidad: 'GAD Municipal Baños de Agua Santa',
          recurrencia: 'ANUAL',
          proximoVencimiento: new Date(anio, 5, 30),
          notas: 'Licencia Única Anual de Funcionamiento para alojamiento turístico.',
        },
      ],
    });
  }

  console.log('✅ Seed completado: habitaciones, inventario, obligaciones, usuarios.');
  console.log('👤 Usuarios (login por USUARIO):');
  console.log(`   ADMIN        usuario: admin        / ${adminPass}`);
  console.log('   RECEPCIÓN    usuario: recepcion    / Recepcion123');
  console.log('   OPERACIONES  usuario: operaciones  / Operaciones123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
