/**
 * FIRMA XAdES-BES (enveloped) para comprobantes electrónicos del SRI.
 *
 * Implementa el perfil exacto que exige la Ficha Técnica (esquema offline):
 *  - Firma RSA-SHA1 enveloped dentro del elemento raíz <factura>.
 *  - 3 referencias: SignedProperties, Certificate (KeyInfo) y #comprobante.
 *  - QualifyingProperties con SigningTime y SigningCertificate.
 *
 * Basada en las implementaciones abiertas probadas contra el SRI
 * (open-factura / xades-bes-sri). El XML del comprobante debe generarse
 * en forma canónica (como hace facturaXml.ts): sin tags auto-cerrados y
 * sin espacios entre elementos, de modo que el digest sea estable.
 *
 * Funciona con certificados .p12 de Banco Central, Security Data,
 * UANATACA, etc. (clave RSA 2048 bits).
 */
import forge from 'node-forge';
import fs from 'node:fs';

const XMLNS =
  'xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#"';

const sha1Base64 = (texto: string): string => {
  const md = forge.md.sha1.create();
  md.update(texto, 'utf8');
  return forge.util.encode64(md.digest().getBytes());
};

const sha1Base64Bytes = (bytes: string): string => {
  const md = forge.md.sha1.create();
  md.update(bytes);
  return forge.util.encode64(md.digest().getBytes());
};

/** Base64 partido en líneas de 76 caracteres (formato PEM-like que espera el SRI). */
const partir76 = (b64: string): string => b64.replace(/(.{76})/g, '$1\n');

const aleatorio = (): number => Math.floor(Math.random() * 990000) + 990;

interface MaterialFirma {
  privateKey: forge.pki.rsa.PrivateKey;
  certificado: forge.pki.Certificate;
  certificadoDer: string; // bytes DER
}

/** Extrae clave privada y certificado de firma desde el .p12. */
function extraerMaterial(p12Buffer: Buffer, password: string): MaterialFirma {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString('binary')));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  // Clave privada: puede venir como pkcs8ShroudedKeyBag o keyBag
  const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
    forge.pki.oids.pkcs8ShroudedKeyBag
  ];
  const simples = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
  const keyBag = shrouded?.[0] ?? simples?.[0];
  if (!keyBag?.key) throw new Error('No se encontró la clave privada en el .p12 (¿contraseña correcta?)');
  const privateKey = keyBag.key as forge.pki.rsa.PrivateKey;

  // Certificado: elegir el que corresponde a la clave privada (mismo módulo RSA)
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  let certificado: forge.pki.Certificate | undefined;
  for (const bag of certBags) {
    const cert = bag.cert;
    if (!cert) continue;
    const pub = cert.publicKey as forge.pki.rsa.PublicKey;
    if (pub?.n && privateKey.n && pub.n.compareTo(privateKey.n) === 0) {
      certificado = cert;
      break;
    }
  }
  certificado ??= certBags.find((b) => b.cert)?.cert ?? undefined;
  if (!certificado) throw new Error('No se encontró el certificado de firma en el .p12');

  const certificadoDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificado)).getBytes();
  return { privateKey, certificado, certificadoDer };
}

/** Nombre del emisor del certificado en orden RFC 2253 (CN primero). */
function issuerName(cert: forge.pki.Certificate): string {
  return cert.issuer.attributes
    .slice()
    .reverse()
    .map((a) => `${a.shortName ?? a.name}=${a.value}`)
    .join(',');
}

/** Serial del certificado en decimal (viene en hexadecimal). */
const serialDecimal = (cert: forge.pki.Certificate): string => BigInt('0x' + cert.serialNumber).toString(10);

export interface OpcionesFirma {
  p12Path?: string;
  p12Buffer?: Buffer;
  password: string;
}

/**
 * Firma el XML del comprobante y devuelve el documento con la
 * <ds:Signature> insertada antes de </factura>.
 */
export function firmarComprobante(xml: string, opciones: OpcionesFirma): string {
  const buffer =
    opciones.p12Buffer ??
    (opciones.p12Path ? fs.readFileSync(opciones.p12Path) : undefined);
  if (!buffer) throw new Error('Debe proporcionar p12Path o p12Buffer');

  const { privateKey, certificado, certificadoDer } = extraerMaterial(buffer, opciones.password);

  // ---------- Material del certificado ----------
  const certB64 = partir76(forge.util.encode64(certificadoDer));
  const certDigest = sha1Base64Bytes(certificadoDer);
  const pub = certificado.publicKey as forge.pki.rsa.PublicKey;
  const modulo = partir76(forge.util.encode64(forge.util.hexToBytes(pub.n.toString(16))));
  const exponente = forge.util.encode64(forge.util.hexToBytes(pub.e.toString(16))); // AQAB

  // ---------- Digest del comprobante (referencia enveloped #comprobante) ----------
  // C14N excluye la declaración XML, por eso se retira antes de calcular el hash.
  const sinDeclaracion = xml.replace(/<\?xml[^?]*\?>/, '');
  const digestComprobante = sha1Base64(sinDeclaracion);

  // ---------- Identificadores ----------
  const n = {
    certificate: aleatorio(),
    signature: aleatorio(),
    signedProperties: aleatorio(),
    signedInfo: aleatorio(),
    signedPropsRef: aleatorio(),
    referenceId: aleatorio(),
    signatureValue: aleatorio(),
    object: aleatorio(),
  };

  const idSignature = `Signature${n.signature}`;
  const idCertificate = `Certificate${n.certificate}`;
  const idSignedProps = `${idSignature}-SignedProperties${n.signedProperties}`;
  const idReference = `Reference-ID-${n.referenceId}`;

  const horaFirma = new Date().toISOString();

  // ---------- SignedProperties (XAdES) ----------
  const signedProperties =
    `<etsi:SignedProperties Id="${idSignedProps}">` +
    '<etsi:SignedSignatureProperties>' +
    `<etsi:SigningTime>${horaFirma}</etsi:SigningTime>` +
    '<etsi:SigningCertificate>' +
    '<etsi:Cert>' +
    '<etsi:CertDigest>' +
    '<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1">' +
    '</ds:DigestMethod>' +
    `<ds:DigestValue>${certDigest}</ds:DigestValue>` +
    '</etsi:CertDigest>' +
    '<etsi:IssuerSerial>' +
    `<ds:X509IssuerName>${issuerName(certificado)}</ds:X509IssuerName>` +
    `<ds:X509SerialNumber>${serialDecimal(certificado)}</ds:X509SerialNumber>` +
    '</etsi:IssuerSerial>' +
    '</etsi:Cert>' +
    '</etsi:SigningCertificate>' +
    '</etsi:SignedSignatureProperties>' +
    '<etsi:SignedDataObjectProperties>' +
    `<etsi:DataObjectFormat ObjectReference="#${idReference}">` +
    '<etsi:Description>contenido comprobante</etsi:Description>' +
    '<etsi:MimeType>text/xml</etsi:MimeType>' +
    '</etsi:DataObjectFormat>' +
    '</etsi:SignedDataObjectProperties>' +
    '</etsi:SignedProperties>';

  // Para el digest, el elemento se canoniza heredando los namespaces del ancestro
  const signedPropertiesConNs = signedProperties.replace(
    '<etsi:SignedProperties ',
    `<etsi:SignedProperties ${XMLNS} `,
  );
  const digestSignedProps = sha1Base64(signedPropertiesConNs);

  // ---------- KeyInfo ----------
  const keyInfo =
    `<ds:KeyInfo Id="${idCertificate}">` +
    '<ds:X509Data>' +
    `<ds:X509Certificate>\n${certB64}\n</ds:X509Certificate>` +
    '</ds:X509Data>' +
    '<ds:KeyValue>' +
    '<ds:RSAKeyValue>' +
    `<ds:Modulus>\n${modulo}\n</ds:Modulus>` +
    `<ds:Exponent>${exponente}</ds:Exponent>` +
    '</ds:RSAKeyValue>' +
    '</ds:KeyValue>' +
    '</ds:KeyInfo>';

  const keyInfoConNs = keyInfo.replace('<ds:KeyInfo ', `<ds:KeyInfo ${XMLNS} `);
  const digestKeyInfo = sha1Base64(keyInfoConNs);

  // ---------- SignedInfo ----------
  const signedInfo =
    `<ds:SignedInfo Id="Signature-SignedInfo${n.signedInfo}">` +
    '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315">' +
    '</ds:CanonicalizationMethod>' +
    '<ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1">' +
    '</ds:SignatureMethod>' +
    `<ds:Reference Id="SignedPropertiesID${n.signedPropsRef}" Type="http://uri.etsi.org/01903#SignedProperties" URI="#${idSignedProps}">` +
    '<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1">' +
    '</ds:DigestMethod>' +
    `<ds:DigestValue>${digestSignedProps}</ds:DigestValue>` +
    '</ds:Reference>' +
    `<ds:Reference URI="#${idCertificate}">` +
    '<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1">' +
    '</ds:DigestMethod>' +
    `<ds:DigestValue>${digestKeyInfo}</ds:DigestValue>` +
    '</ds:Reference>' +
    `<ds:Reference Id="${idReference}" URI="#comprobante">` +
    '<ds:Transforms>' +
    '<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature">' +
    '</ds:Transform>' +
    '</ds:Transforms>' +
    '<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1">' +
    '</ds:DigestMethod>' +
    `<ds:DigestValue>${digestComprobante}</ds:DigestValue>` +
    '</ds:Reference>' +
    '</ds:SignedInfo>';

  // ---------- Firma RSA-SHA1 del SignedInfo canonizado ----------
  const signedInfoConNs = signedInfo.replace('<ds:SignedInfo ', `<ds:SignedInfo ${XMLNS} `);
  const md = forge.md.sha1.create();
  md.update(signedInfoConNs, 'utf8');
  const signatureValue = partir76(forge.util.encode64(privateKey.sign(md)));

  // ---------- Ensamblado ----------
  const firma =
    `<ds:Signature ${XMLNS} Id="${idSignature}">` +
    signedInfo +
    `<ds:SignatureValue Id="SignatureValue${n.signatureValue}">\n${signatureValue}\n</ds:SignatureValue>` +
    keyInfo +
    `<ds:Object Id="${idSignature}-Object${n.object}">` +
    `<etsi:QualifyingProperties Target="#${idSignature}">` +
    signedProperties +
    '</etsi:QualifyingProperties>' +
    '</ds:Object>' +
    '</ds:Signature>';

  return xml.replace('</factura>', firma + '</factura>');
}

/** Datos informativos del certificado (para mostrar en /ajustes). */
export function infoCertificado(opciones: OpcionesFirma): {
  titular: string;
  emisor: string;
  validoDesde: string;
  validoHasta: string;
  vigente: boolean;
} {
  const buffer =
    opciones.p12Buffer ?? (opciones.p12Path ? fs.readFileSync(opciones.p12Path) : undefined);
  if (!buffer) throw new Error('Debe proporcionar p12Path o p12Buffer');
  const { certificado } = extraerMaterial(buffer, opciones.password);
  const cn = certificado.subject.getField('CN')?.value ?? 'Desconocido';
  const ahora = new Date();
  return {
    titular: String(cn),
    emisor: issuerName(certificado),
    validoDesde: certificado.validity.notBefore.toISOString(),
    validoHasta: certificado.validity.notAfter.toISOString(),
    vigente: ahora >= certificado.validity.notBefore && ahora <= certificado.validity.notAfter,
  };
}
