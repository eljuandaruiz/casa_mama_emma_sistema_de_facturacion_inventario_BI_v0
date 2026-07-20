# Certificado de firma electrónica (.p12)

Aquí va el archivo de firma electrónica del SRI (formato PKCS#12, extensión
`.p12` o `.pfx`), emitido por una entidad autorizada en Ecuador (Banco Central,
Security Data, UANATACA, etc.).

## Cómo instalarlo

1. Copia tu archivo de firma a esta carpeta, por ejemplo: `firma.p12`
2. En el archivo `.env` (en la raíz del proyecto) apunta a él y pon su clave:

   ```env
   SRI_P12_PATH="./certificados/firma.p12"
   SRI_P12_PASSWORD="tu-clave-del-certificado"
   ```

3. Reinicia el servidor.

## Seguridad

- El `.gitignore` de esta carpeta impide subir el `.p12` a git. **Nunca** lo
  compartas ni lo publiques.
- La clave del certificado vive solo en `.env` (que tampoco se versiona).
- En producción, sube el `.p12` por SFTP/consola del servidor, no por el
  repositorio.

Mientras no exista el certificado, el sistema genera y numera las facturas con
su clave de acceso, pero quedan en estado `ERROR_FIRMA` (no se firman ni se
envían al SRI). Al instalar el `.p12`, el flujo se completa automáticamente.
