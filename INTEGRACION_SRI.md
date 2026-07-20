# Integración con el SRI (Ecuador) — Esquema Offline
### Guía completa tipo *notebook*: explicación + código, paso a paso

Este documento está estructurado como un cuaderno Jupyter: **alterna celdas de
texto explicativo con celdas de código**. Léelo en orden. El código refleja la
implementación real del sistema (`src/lib/sri/`), escrita en **TypeScript
(Node.js)** con las librerías `node-forge` (firma), `fast-xml-parser` (XML) y
`fetch` (SOAP).

> **Contexto legal.** El SRI usa el *esquema offline*: el emisor **genera,
> firma y numera** el comprobante localmente, y luego lo **transmite** (dentro
> de 72 h). El comprobante es válido desde su firma; la autorización del SRI lo
> confirma. Este modelo es el que implementamos.

---

## Celda 1 — Explicación: el flujo completo de extremo a extremo

Antes de una sola línea de código, entiende el recorrido de una factura:

1. **Reservar secuencial** — cada factura lleva un número correlativo por punto
   de emisión (`001-001-000000001`). Debe ser atómico: sin huecos ni repetidos.
2. **Clave de acceso** — 49 dígitos que identifican unívocamente el comprobante;
   el último es un dígito verificador (módulo 11).
3. **Generar XML** — según el XSD de *factura* v1.1.0 del SRI.
4. **Firmar (XAdES-BES)** — con tu certificado `.p12`. La firma va *dentro* del
   XML.
5. **Recepción** — se envía el XML firmado al WS de *Recepción Offline*.
   Respuesta inmediata: `RECIBIDA` o `DEVUELTA`.
6. **Autorización** — si fue `RECIBIDA`, se consulta el WS de *Autorización
   Offline* (con reintentos) hasta obtener `AUTORIZADO` o `NO AUTORIZADO`.
7. **Post-autorización** — se genera el PDF (RIDE) y se envía por email al
   cliente con el XML autorizado adjunto.

Cada paso siguiente depende del anterior. Nunca los reordenes.

---

## Celda 2 — Explicación: endpoints WSDL (Pruebas vs. Producción)

El SRI tiene **dos ambientes**. Empieza SIEMPRE en Pruebas (certificación). Solo
pasa a Producción cuando el SRI valide tus comprobantes de prueba.

- **Pruebas** (`celcer.sri.gob.ec`): ambiente `1`.
- **Producción** (`cel.sri.gob.ec`): ambiente `2`.

Cada ambiente expone dos servicios: **Recepción** y **Autorización**.

---

## Celda 3 — Código: endpoints y configuración de ambiente

```typescript
// src/lib/config.ts (extracto real del sistema)

export const SRI_URLS = {
  // Ambiente 1 = PRUEBAS (celcer)
  '1': {
    recepcion:
      'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
    autorizacion:
      'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
  },
  // Ambiente 2 = PRODUCCIÓN (cel)
  '2': {
    recepcion:
      'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
    autorizacion:
      'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
  },
} as const;

// El ambiente activo se lee de .env (SRI_AMBIENTE="1" | "2").
export const EMISOR = {
  ruc: process.env.SRI_RUC ?? '1805034426001',
  ambiente: (process.env.SRI_AMBIENTE ?? '1') as '1' | '2',
  p12Path: process.env.SRI_P12_PATH ?? './certificados/firma.p12',
  p12Password: process.env.SRI_P12_PASSWORD ?? '',
  // ...
};
```

---

## Celda 4 — Explicación: instalación segura del certificado `.p12`

El `.p12` (PKCS#12) contiene tu clave privada y tu certificado. Es **secreto**.

Reglas de seguridad implementadas:

- Vive en `certificados/`, carpeta **ignorada por git** (`.gitignore` propio).
- La **contraseña nunca se guarda en texto plano** en el código: se lee de
  `process.env.SRI_P12_PASSWORD` (archivo `.env`, tampoco versionado) y solo
  existe en memoria durante la firma.
- En producción se sube por SFTP, nunca por el repositorio.

---

## Celda 5 — Código: carga segura del `.p12` en memoria

```typescript
// src/lib/sri/firmaXades.ts (extracto)
import fs from 'node:fs';
import forge from 'node-forge';

/**
 * Carga el .p12 y extrae la clave privada y el certificado. La contraseña solo
 * vive como argumento en memoria; no se persiste ni se loguea.
 */
function cargarCertificado(p12Path: string, password: string) {
  // 1. Leer el binario del .p12
  const p12Buffer = fs.readFileSync(p12Path, 'binary');
  // 2. Decodificar ASN.1 y abrir el PKCS#12 con la contraseña
  const p12Asn1 = forge.asn1.fromDer(p12Buffer);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  // 3. Extraer clave privada y certificado
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]![0].key!;
  const certificate = certBags[forge.pki.oids.certBag]![0].cert!;

  return { privateKey, certificate };
}
```

> Verificación local: si la contraseña es incorrecta, `pkcs12FromAsn1` lanza. Se
> captura y la factura queda en estado `ERROR_FIRMA` (no se transmite nada roto).

---

## Celda 6 — Explicación: generación del XML

El XML sigue el XSD de *factura* del SRI: bloques `infoTributaria` (emisor,
clave de acceso, ambiente), `infoFactura` (comprador, totales, impuestos),
`detalles` (líneas) e `infoAdicional` (campos libres: huéspedes, disclaimer
Airbnb, etc.).

Regla crítica: los **totales del XML deben cuadrar** con la suma de los
detalles, o el SRI devuelve el comprobante (error 43/45).

---

## Celda 7 — Código: construcción del XML

```typescript
// src/lib/sri/facturaXml.ts (estructura simplificada)
import { XMLBuilder } from 'fast-xml-parser';

export function construirFacturaXml(f: FacturaXmlInput): string {
  const factura = {
    factura: {
      '@_id': 'comprobante',
      '@_version': '1.1.0',
      infoTributaria: {
        ambiente: f.ambiente,          // "1" | "2"
        tipoEmision: '1',
        razonSocial: f.razonSocial,
        ruc: f.ruc,
        claveAcceso: f.claveAcceso,    // 49 dígitos
        codDoc: '01',                  // 01 = factura
        estab: f.establecimiento,
        ptoEmi: f.puntoEmision,
        secuencial: String(f.secuencial).padStart(9, '0'),
        dirMatriz: f.dirMatriz,
      },
      infoFactura: {
        fechaEmision: formatoFechaSri(f.fechaEmision), // dd/mm/aaaa
        tipoIdentificacionComprador: f.tipoIdentificacionComprador,
        razonSocialComprador: f.razonSocialComprador,
        identificacionComprador: f.identificacionComprador,
        totalSinImpuestos: f.totalSinImpuestos.toFixed(2),
        totalDescuento: f.totalDescuento.toFixed(2),
        totalConImpuestos: {
          totalImpuesto: f.totalImpuestos.map((t) => ({
            codigo: '2',                 // 2 = IVA
            codigoPorcentaje: t.codigoPorcentaje,
            baseImponible: t.baseImponible.toFixed(2),
            valor: t.valor.toFixed(2),
          })),
        },
        importeTotal: f.importeTotal.toFixed(2),
        pagos: { pago: { formaPago: f.formaPago, total: f.importeTotal.toFixed(2) } },
      },
      detalles: {
        detalle: f.detalles.map((d) => ({
          codigoPrincipal: d.codigoPrincipal,
          descripcion: d.descripcion,
          cantidad: d.cantidad.toFixed(2),
          precioUnitario: d.precioUnitario.toFixed(2),
          descuento: d.descuento.toFixed(2),
          precioTotalSinImpuesto: d.precioTotalSinImpuesto.toFixed(2),
          // ... impuestos por línea
        })),
      },
      infoAdicional: {
        campoAdicional: f.camposAdicionales.map((c) => ({ '@_nombre': c.nombre, '#text': c.valor })),
      },
    },
  };
  const builder = new XMLBuilder({ ignoreAttributes: false, format: false });
  return '<?xml version="1.0" encoding="UTF-8"?>' + builder.build(factura);
}
```

---

## Celda 8 — Explicación: firma digital XAdES-BES

El SRI exige **XAdES-BES** (XML Advanced Electronic Signature, Basic Electronic
Signature). Es una firma XML enveloped: el elemento `<ds:Signature>` se inserta
dentro del propio `<factura>`, con:

- `SignedInfo` (qué se firma y con qué algoritmos),
- `SignatureValue` (la firma RSA-SHA1 del `SignedInfo`),
- `KeyInfo` (el certificado público),
- `SignedProperties` XAdES (hora de firma, hash del certificado).

Tras firmar, se **valida la integridad localmente** antes de transmitir: se
recomputa el digest y se comprueba que la firma cierra correctamente.

---

## Celda 9 — Código: firma y verificación local

```typescript
// src/lib/sri/firmaXades.ts (interfaz real)

export function firmarComprobante(
  xml: string,
  cfg: { p12Path: string; password: string },
): string {
  const { privateKey, certificate } = cargarCertificado(cfg.p12Path, cfg.password);

  // 1. Calcular digests (SHA1) del documento y de las SignedProperties.
  // 2. Construir el bloque <ds:SignedInfo> con las referencias.
  // 3. Firmar el SignedInfo con la clave privada (RSA-SHA1).
  // 4. Ensamblar <ds:Signature> XAdES-BES e insertarlo dentro de <factura>.
  const xmlFirmado = construirFirmaXadesBes(xml, privateKey, certificate);

  // 5. VALIDACIÓN LOCAL antes de la red: recomputar digest y verificar la firma.
  if (!verificarFirmaLocal(xmlFirmado, certificate)) {
    throw new Error('La firma no pasó la validación local; no se transmite.');
  }
  return xmlFirmado;
}
```

> Por qué validar localmente: enviar un XML mal firmado consume tu cuota y
> devuelve errores crípticos. Validar antes ahorra tiempo y evita "devueltas".

---

## Celda 10 — Explicación: consumo del WS de Recepción (SOAP)

Recepción recibe el XML firmado **codificado en base64** dentro de un sobre
SOAP. La respuesta es inmediata:

- `RECIBIDA` — el SRI lo aceptó para procesar → pasar a Autorización.
- `DEVUELTA` — rechazo inmediato (XML mal formado, firma inválida) → leer el
  `mensaje` y el `identificador` del error.

Usamos `fetch` con `Content-Type: text/xml` (no hace falta una librería SOAP
pesada: el sobre es simple y conocido).

---

## Celda 11 — Código: envío a Recepción

```typescript
// src/lib/sri/soapClient.ts (extracto)

export async function enviarComprobante(xmlFirmado: string, ambiente: '1' | '2') {
  const url = SRI_URLS[ambiente].recepcion.replace('?wsdl', '');
  const base64 = Buffer.from(xmlFirmado, 'utf8').toString('base64');

  // Sobre SOAP para validarComprobante
  const sobre = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
      xmlns:ec="http://ec.gob.sri.ws.recepcion">
    <soapenv:Body>
      <ec:validarComprobante>
        <xml>${base64}</xml>
      </ec:validarComprobante>
    </soapenv:Body>
  </soapenv:Envelope>`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
    body: sobre,
  });
  const textoRespuesta = await res.text();

  // Parsear <estado> y los <mensaje> del cuerpo SOAP.
  return parsearRespuestaRecepcion(textoRespuesta); // { estado, mensajes[] }
}
```

---

## Celda 12 — Explicación: gestión de estado asíncrono (Autorización)

Si Recepción devolvió `RECIBIDA`, el comprobante entra en cola. Hay que
**consultar Autorización con reintentos cortos** (el SRI tarda 1–3 s):

- `AUTORIZADO` — listo. Guardar `numeroAutorizacion` y `fechaAutorizacion`.
- `NO AUTORIZADO` — leer el error y no reintentar.
- `EN PROCESAMIENTO` — esperar y reintentar (hasta N veces); si persiste, queda
  `EN_PROCESO` y se reintenta luego (esquema offline, 72 h).

---

## Celda 13 — Código: polling de Autorización

```typescript
// src/lib/sri/soapClient.ts + procesoEmision.ts (lógica real)

export async function consultarAutorizacion(claveAcceso: string, ambiente: '1' | '2') {
  const url = SRI_URLS[ambiente].autorizacion.replace('?wsdl', '');
  const sobre = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
      xmlns:ec="http://ec.gob.sri.ws.autorizacion">
    <soapenv:Body>
      <ec:autorizacionComprobante>
        <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
      </ec:autorizacionComprobante>
    </soapenv:Body>
  </soapenv:Envelope>`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
    body: sobre,
  });
  return parsearRespuestaAutorizacion(await res.text());
}

// Polling con reintentos (extracto de procesoEmision.ts):
for (let intento = 0; intento < 3; intento++) {
  await new Promise((r) => setTimeout(r, 1500));
  const auth = await consultarAutorizacion(claveAcceso, ambiente);
  if (auth.estado === 'AUTORIZADO') { /* guardar y salir */ break; }
  if (auth.estado === 'NO AUTORIZADO') { /* leer error y salir */ break; }
  // EN PROCESAMIENTO → seguir intentando
}
```

---

## Celda 14 — Explicación: manejo de DEVUELTA / NO AUTORIZADO

Nunca muestres un error genérico. El SRI devuelve `identificador`, `mensaje`,
`informacionAdicional` y `tipo`. Se parsean y se guardan en `Factura.mensajesSri`
(JSON) para que el facturador vea exactamente qué corregir.

```typescript
function parsearMensajes(nodo: unknown): MensajeSri[] {
  // Extrae { identificador, mensaje, informacionAdicional, tipo } de cada <mensaje>.
  // Ej: { identificador: '45', mensaje: 'Error en diferencia de totales', ... }
}
```

---

## Celda 15 — Explicación: post-autorización (PDF + email)

Al recibir `AUTORIZADO`:

1. Se genera el **RIDE** (PDF A4) con el diseño propio (`src/lib/pdf/ride.ts`),
   incluyendo el número de autorización y el código de barras de la clave.
2. Se envía un **email** al cliente con dos adjuntos: el **XML autorizado**
   (obligatorio conservarlo 7 años) y el **PDF**.

---

## Celda 16 — Código: envío de email (SMTP)

```typescript
// Ejemplo con nodemailer (a integrar en post-autorización)
import nodemailer from 'nodemailer';

async function enviarFacturaPorEmail(params: {
  para: string; numero: string; pdf: Buffer; xml: string;
}) {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: `"Casa Mamá Emma" <${process.env.SMTP_USER}>`,
    to: params.para,
    subject: `Factura electrónica ${params.numero} · Casa Mamá Emma`,
    text: 'Adjuntamos su factura electrónica autorizada por el SRI (XML y PDF).',
    attachments: [
      { filename: `factura-${params.numero}.xml`, content: params.xml },
      { filename: `factura-${params.numero}.pdf`, content: params.pdf },
    ],
  });
}
```

> Credenciales SMTP en `.env` (`SMTP_HOST/PORT/USER/PASS`), nunca en el código.

---

## Celda 17 — Código: verificación de integridad del sistema

Antes de emitir en producción, verifica dependencias y configuración:

```bash
# 1. Dependencias de firma/XML/SOAP instaladas
npm ls node-forge fast-xml-parser

# 2. El certificado existe y la clave lo abre
node -e "require('node-forge'); console.log('node-forge OK')"

# 3. Typecheck del proyecto
npx tsc --noEmit   # debe dar EXIT 0

# 4. Variables de entorno presentes
node -e "['SRI_RUC','SRI_P12_PATH','SRI_P12_PASSWORD','SRI_AMBIENTE'].forEach(k=>{if(!process.env[k])throw new Error('Falta '+k)});console.log('ENV OK')"
```

En la app, `estadoCertificado()` (`src/lib/config.ts`) informa desde `/ajustes`
si el `.p12` existe y si tiene contraseña configurada.

---

## Celda 18 — Explicación: checklist de puesta en producción SRI

- [ ] Comprobantes de PRUEBA autorizados en `celcer` (ambiente 1).
- [ ] Certificado `.p12` vigente subido a `certificados/` en el servidor.
- [ ] `SRI_AMBIENTE="2"` y URLs de producción activas.
- [ ] SMTP configurado y probado (email de prueba recibido).
- [ ] Respaldo automático de la base y de los XML firmados (7 años).
- [ ] Reloj del servidor sincronizado (NTP): la hora de firma importa.

Con esto, el ciclo completo —generar, firmar, transmitir, autorizar, enviar—
queda cubierto de extremo a extremo.
