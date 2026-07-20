/**
 * Envío de correo (SMTP) — entrega automática de la factura autorizada.
 *
 * DISEÑO DEGRADADO: si no hay credenciales SMTP en el entorno, la función NO
 * lanza ni bloquea; devuelve { enviado: false, motivo }. Así el flujo de
 * emisión de factura nunca falla por culpa del correo. Cuando el usuario
 * configure SMTP_HOST / SMTP_USER / SMTP_PASS en .env, empieza a enviar solo.
 *
 * Variables de entorno:
 *   SMTP_HOST, SMTP_PORT (def. 587), SMTP_USER, SMTP_PASS, SMTP_FROM (opcional)
 */
import nodemailer from 'nodemailer';

export function smtpConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export interface AdjuntoFactura {
  para: string; // email del cliente
  numeroCompleto: string; // "001-001-000000001"
  pdf: Buffer; // RIDE en PDF
  xml: string; // XML autorizado (se conserva 7 años)
}

export interface ResultadoEmail {
  enviado: boolean;
  motivo?: string;
}

/**
 * Envía la factura (PDF + XML) al cliente por SMTP. Nunca lanza: cualquier
 * fallo se devuelve como { enviado:false, motivo } para no romper la emisión.
 */
/**
 * Envía el enlace de recuperación de contraseña. Mismo diseño degradado:
 * nunca lanza; si SMTP no está configurado devuelve el motivo.
 */
export async function enviarCorreoRecuperacion(
  para: string,
  nombre: string,
  enlace: string,
): Promise<ResultadoEmail> {
  if (!smtpConfigurado()) return { enviado: false, motivo: 'SMTP no configurado' };
  try {
    const puerto = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      secure: puerto === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const remitente = process.env.SMTP_FROM || `Casa Mamá Emma <${process.env.SMTP_USER}>`;
    await transporter.sendMail({
      from: remitente,
      to: para,
      subject: 'Recuperación de contraseña · Casa Mamá Emma',
      text:
        `Hola ${nombre},\n\n` +
        'Recibimos una solicitud para restablecer tu contraseña del sistema de ' +
        'Casa Mamá Emma. Abre este enlace (válido por 1 hora):\n\n' +
        `${enlace}\n\n` +
        'Si no fuiste tú, ignora este correo: tu contraseña actual sigue vigente.',
    });
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: (e as Error).message };
  }
}

export async function enviarFacturaPorEmail(a: AdjuntoFactura): Promise<ResultadoEmail> {
  if (!smtpConfigurado()) {
    return { enviado: false, motivo: 'SMTP no configurado' };
  }
  if (!a.para || !/.+@.+\..+/.test(a.para)) {
    return { enviado: false, motivo: 'El cliente no tiene email válido' };
  }

  try {
    const puerto = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      secure: puerto === 465, // 465 = SSL directo; 587 = STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const remitente = process.env.SMTP_FROM || `Casa Mamá Emma <${process.env.SMTP_USER}>`;

    await transporter.sendMail({
      from: remitente,
      to: a.para,
      subject: `Factura electrónica ${a.numeroCompleto} · Casa Mamá Emma`,
      text:
        'Estimado huésped,\n\n' +
        'Adjuntamos su factura electrónica autorizada por el SRI: el archivo XML ' +
        '(comprobante legal) y el PDF (RIDE) para su impresión.\n\n' +
        'Gracias por su visita a Casa Mamá Emma, Baños de Agua Santa.',
      attachments: [
        { filename: `factura-${a.numeroCompleto}.xml`, content: a.xml, contentType: 'application/xml' },
        { filename: `factura-${a.numeroCompleto}.pdf`, content: a.pdf, contentType: 'application/pdf' },
      ],
    });
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: (e as Error).message };
  }
}
