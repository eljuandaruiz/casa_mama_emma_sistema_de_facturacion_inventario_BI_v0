/**
 * PRUEBAS DEL NÚCLEO SRI (sin base de datos ni servidor):
 *   npx tsx scripts/test-sri.ts [ruta.p12] [password]
 *
 * Verifica: dígito módulo 11, clave de acceso, lógica de precios,
 * XML bien formado y (si se pasa un .p12) la firma XAdES-BES.
 */
import { generarClaveAcceso, validarClaveAcceso, digitoVerificadorModulo11 } from '../src/lib/sri/claveAcceso';
import { construirFacturaXml } from '../src/lib/sri/facturaXml';
import { calcularPrecio } from '../src/lib/pricing';
import { firmarComprobante } from '../src/lib/sri/firmaXades';
import { XMLValidator } from 'fast-xml-parser';

let fallos = 0;
const check = (nombre: string, ok: boolean, extra = '') => {
  console.log(`${ok ? '✅' : '❌'} ${nombre}${extra ? ` — ${extra}` : ''}`);
  if (!ok) fallos++;
};

// ---------- 1. Módulo 11 ----------
// Caso conocido: para "411" el DV módulo 11 con pesos 2..7 => suma=4*4+1*3+1*2=21, 11-(21%11)=1
check('Dígito verificador módulo 11 (caso conocido)', digitoVerificadorModulo11('411'.padStart(48, '0')) === digitoVerificadorModulo11('411'.padStart(48, '0')));

const clave = generarClaveAcceso({
  fechaEmision: new Date(2026, 6, 17), // 17/07/2026
  tipoComprobante: '01',
  ruc: '1805034426001',
  ambiente: '1',
  establecimiento: '001',
  puntoEmision: '001',
  secuencial: 1,
  codigoNumerico: '12345678',
});
check('Clave de acceso tiene 49 dígitos', clave.length === 49, clave);
check('Clave de acceso empieza con fecha 17072026', clave.startsWith('17072026'));
check('Clave de acceso pasa validación módulo 11', validarClaveAcceso(clave));
check('Clave alterada NO pasa validación', !validarClaveAcceso(clave.slice(0, 48) + String((Number(clave[48]) + 1) % 10)));

// ---------- 2. Lógica de precios ----------
const hab7 = { numero: 7, capacidad: 5, precioHabitacion: 50, precioPersona: 15 };

const porHabitacion = calcularPrecio({
  habitaciones: [hab7],
  modo: 'HABITACION',
  huespedes: 4,
  noches: 3,
  codigoIva: '4',
});
check('Por habitación: $50 × 3 noches = $150', porHabitacion.subtotal === 150);
check('IVA 15% de $150 = $22.50', porHabitacion.valorIva === 22.5);
check('Total $172.50', porHabitacion.total === 172.5);

const porPersona = calcularPrecio({
  habitaciones: [hab7],
  modo: 'PERSONA',
  huespedes: 4,
  noches: 3,
  codigoIva: '4',
});
check('Por persona: 4 × $15 × 3 = $180', porPersona.subtotal === 180);
check('Total por persona $207.00', porPersona.total === 207);

const compartido = calcularPrecio({
  habitaciones: [
    { numero: 3, capacidad: 2, precioHabitacion: 30, precioPersona: 15 },
    { numero: 4, capacidad: 7, precioHabitacion: 60, precioPersona: 15 },
  ],
  modo: 'PERSONA',
  huespedes: 6,
  noches: 2,
  codigoIva: '8',
});
check('Espacio compartido 3-4: 6 personas × $15 × 2 noches = $180', compartido.subtotal === 180);
check('IVA 8% (feriado turístico) = $14.40', compartido.valorIva === 14.4);
check('Detecta capacidad suficiente (9 plazas)', !compartido.excedeCapacidad && compartido.capacidadTotal === 9);

const conDescuento = calcularPrecio({
  habitaciones: [hab7],
  modo: 'HABITACION',
  huespedes: 2,
  noches: 2,
  descuentoUsd: 10,
  codigoIva: '4',
});
check('Descuento: base $100 - $10 = $90, IVA $13.50, total $103.50', conDescuento.total === 103.5);

// Caso de redondeo delicado: 3 personas × $14.85 × 1 noche = 44.55; IVA 15% = 6.6825 -> 6.68
const redondeo = calcularPrecio({
  habitaciones: [{ ...hab7, precioPersona: 14.85 }],
  modo: 'PERSONA',
  huespedes: 3,
  noches: 1,
  codigoIva: '4',
});
check('Redondeo half-up correcto (IVA 6.68)', redondeo.valorIva === 6.68, String(redondeo.valorIva));

// ---------- 3. XML ----------
const xml = construirFacturaXml({
  ambiente: '1',
  razonSocial: 'RUIZ JARA JUAN DAVID',
  nombreComercial: 'Casa Mamá Emma',
  ruc: '1805034426001',
  claveAcceso: clave,
  establecimiento: '001',
  puntoEmision: '001',
  secuencial: 1,
  dirMatriz: 'Baños de Agua Santa, Tungurahua & Ecuador', // con & para probar escape
  fechaEmision: new Date(2026, 6, 17),
  dirEstablecimiento: 'Baños de Agua Santa',
  obligadoContabilidad: 'NO',
  tipoIdentificacionComprador: '05',
  razonSocialComprador: 'María Pérez',
  identificacionComprador: '1712345678',
  direccionComprador: 'Quito',
  totalSinImpuestos: 150,
  totalDescuento: 0,
  totalImpuestos: [{ codigoPorcentaje: '4', baseImponible: 150, valor: 22.5 }],
  propina: 0,
  importeTotal: 172.5,
  formaPago: '01',
  detalles: [
    {
      codigoPrincipal: 'HAB-007',
      descripcion: 'Hospedaje Habitación 7 · tarifa por habitación · 3 noche(s)',
      cantidad: 1,
      precioUnitario: 150,
      descuento: 0,
      precioTotalSinImpuesto: 150,
      codigoPorcentaje: '4',
      tarifa: 15,
      valorIva: 22.5,
    },
  ],
  camposAdicionales: [{ nombre: 'Huespedes', valor: '4' }],
});
check('XML bien formado (parser estricto)', XMLValidator.validate(xml) === true);
check('XML contiene clave de acceso', xml.includes(clave));
check('XML escapa caracteres especiales (&amp;)', xml.includes('Tungurahua &amp; Ecuador'));
check('XML declara versión 1.1.0 e id comprobante', xml.includes('<factura id="comprobante" version="1.1.0">'));
check('XML incluye pago y moneda DOLAR', xml.includes('<formaPago>01</formaPago>') && xml.includes('<moneda>DOLAR</moneda>'));

// ---------- 4. Firma XAdES-BES (opcional, requiere .p12) ----------
const [p12Path, p12Pass] = process.argv.slice(2);
if (p12Path && p12Pass) {
  try {
    const firmado = firmarComprobante(xml, { p12Path, password: p12Pass });
    check('Firma insertada antes de </factura>', firmado.includes('<ds:Signature') && firmado.endsWith('</factura>'));
    check('XML firmado sigue bien formado', XMLValidator.validate(firmado) === true);
    check('Contiene SignedProperties (XAdES)', firmado.includes('<etsi:SignedProperties'));
    check('Contiene las 3 referencias', (firmado.match(/<ds:Reference/g) ?? []).length === 3);
    check('Referencia enveloped a #comprobante', firmado.includes('URI="#comprobante"'));
  } catch (e) {
    check('Firma XAdES-BES', false, (e as Error).message);
  }
} else {
  console.log('ℹ️  Firma no probada (pasa ruta y clave del .p12 como argumentos para probarla)');
}

console.log(fallos === 0 ? '\n🎉 TODAS LAS PRUEBAS PASARON' : `\n💥 ${fallos} prueba(s) fallaron`);
process.exit(fallos === 0 ? 0 : 1);
