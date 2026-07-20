# 🏡 Casa Mamá Emma — Sistema de Gestión y Facturación Electrónica SRI

Aplicación web completa para gestionar el hospedaje **Casa Mamá Emma** (Baños de Agua Santa, Ecuador): emite **facturas electrónicas autorizadas por el SRI** bajo el esquema offline, y además cubre CRM de huéspedes, cuentas por pagar (lectura nativa de XML de proveedores), sincronización a Google Sheets, un dashboard de analítica estilo Airbnb Host, calendario de ocupación (anti-overbooking) y caja diaria / cierre de turno.

- **RUC:** 1805034426001 · **Emisor:** Ruiz Jara Juan David · **Régimen:** General
- **Serie:** 001-001 desde el secuencial 000000001
- **IVA:** selector por factura — 15% por defecto (cód. 4), 8% feriados turísticos (cód. 8), 0% (cód. 0)

---

## 1. Stack técnico (y por qué)

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend + Backend | **Next.js 14 (App Router) + TypeScript** | Un solo proyecto en VS Code; las rutas `/api/*` son el backend Node.js. Server Components para el dashboard, Client Components para formularios interactivos. |
| UI | **Tailwind CSS** | Diseño tipo Airbnb/SRI Móvil; responsive real probado a 430px (iPhone 14 Pro Max), 412px (Note 10 Lite) y escritorio. |
| Base de datos | **SQLite + Prisma ORM** | Cero configuración, archivo único fácil de respaldar. Migrar a PostgreSQL = cambiar 2 líneas en `prisma/schema.prisma` (el resto del código no cambia). |
| Firma digital | **node-forge** | Lee el `.p12` y construye la firma **XAdES-BES enveloped RSA-SHA1** exactamente como exige la ficha técnica del SRI (mismo perfil que usan los facturadores comerciales del país). |
| SOAP SRI | **fetch + fast-xml-parser** | Los WS del SRI son SOAP 1.1 simples; un envelope construido a mano es más liviano y auditable que un cliente SOAP genérico. |
| PDF (RIDE) | **pdfmake + bwip-js** | RIDE A4 con código de barras Code-128 de la clave de acceso, espacio para logo y línea de firma física. |
| Excel | **exceljs** | Libro con hojas Ventas / Gastos / Resumen Mensual alineado al Formulario 104. |
| Gráficas | **recharts** | Dashboard estadístico ingresos vs. gastos. |
| Validación | **zod** | Toda entrada del API se valida antes de tocar la base o el SRI. |

### Flujo de emisión (igual al de los sistemas líderes del Ecuador)

```
Formulario → cálculo (habitación/persona) → secuencial atómico → clave de acceso (módulo 11)
   → XML factura v1.1.0 → firma XAdES-BES (.p12) → WS Recepción → WS Autorización
   → estado AUTORIZADA + RIDE PDF → Excel/CSV para la declaración
```

Si no hay internet, la factura queda **FIRMADA/ERROR_ENVIO** y se reintenta desde la pantalla *Facturas* (el esquema offline del SRI da **72 horas** para transmitir).

---

## 2. Puesta en marcha (en tu computadora)

Requisitos: **Node.js 18+** (ideal 20 LTS). En la carpeta del proyecto:

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar el emisor
copy .env.example .env        # Windows (en Mac/Linux: cp .env.example .env)
#    → editar .env: contraseña del .p12, ambiente, dirección, etc.

# 3. Crear la base de datos y sembrar las 6 habitaciones
npm run db:setup

# 4. Probar el núcleo SRI sin tocar nada real
npm run test:sri

# 5. Levantar la app
npm run dev                   # → http://localhost:3000
```

Para usarla desde el celular en la misma red WiFi: `npm run dev -- -H 0.0.0.0` y abre `http://IP-DE-TU-PC:3000`.

### Usuarios y contraseñas por defecto

`npm run db:setup` (o `db:seed`) crea 3 usuarios con **login por nombre de usuario** (el email sigue funcionando como alterno). **Cámbialas antes de producción** desde `/usuarios` (solo ADMIN) o sobrescribiendo `ADMIN_PASSWORD` en `.env` antes de sembrar:

| Rol | Usuario | Contraseña por defecto | Acceso |
|---|---|---|---|
| Administrador | `admin` | `CambiarClave123` (o tu `ADMIN_PASSWORD`) | Todo el sistema |
| Facturador (Recepción) | `recepcion` | `Recepcion123` | Facturas, reservas, ocupación, caja |
| Operaciones | `operaciones` | `Operaciones123` | Mantenimiento, inventario, compras, gastos |

El fondo y el logo del login cambian automáticamente según la hora del cliente (día 06:00–16:59, tarde 17:00–19:59, noche 20:00–05:59).

### Certificado de firma electrónica (.p12)

1. Obtén tu certificado de persona natural (Banco Central, Security Data, UANATACA…).
2. Guárdalo como `certificados/firma.p12` (la carpeta está ignorada por git).
3. Pon la contraseña en `.env` → `SRI_P12_PASSWORD`.
4. Verifica que firma bien: `npx tsx scripts/test-sri.ts certificados/firma.p12 "tu-clave"`.

### Ambiente de pruebas → producción

1. En el portal *SRI en Línea* solicita la **autorización para ambiente de pruebas** de comprobantes electrónicos.
2. Con `SRI_AMBIENTE="1"` emite facturas de prueba (van a `celcer.sri.gob.ec`, no tienen validez tributaria).
3. Cuando todo esté correcto, solicita la **autorización de producción** y cambia `SRI_AMBIENTE="2"`.
4. ⚠️ En producción los secuenciales son definitivos: no borres la base de datos.

---

## 3. Estructura del proyecto

```
casa-mama-emma/
├── prisma/
│   ├── schema.prisma        # Habitaciones, Clientes, Facturas, Gastos, Reservas, CierreCaja, PerfilHuesped…
│   └── seed.ts              # 6 habitaciones + usuarios (admin/recepcion/operaciones)
├── scripts/test-sri.ts      # pruebas del núcleo (clave, precios, XML, firma)
├── src/
│   ├── lib/
│   │   ├── money.ts         # aritmética en centavos + redondeo SRI
│   │   ├── pricing.ts       # ⭐ lógica por HABITACIÓN vs POR PERSONA (compartida UI/backend)
│   │   ├── config.ts        # emisor (.env) + URLs SRI pruebas/producción
│   │   ├── ocupacion.ts     # cruce Reserva + Factura por fecha/habitación (anti-overbooking)
│   │   ├── xmlGastoParser.ts# lector nativo de XML de facturas de proveedores (cuentas por pagar)
│   │   ├── googleSheets.ts  # sync a Google Sheets vía cuenta de servicio (sin SDK googleapis)
│   │   ├── email.ts         # envío del RIDE por SMTP al autorizar (best-effort)
│   │   ├── auth/            # roles.ts (RBAC), sesion.ts (cookie HMAC), servidor.ts (guards)
│   │   ├── sri/
│   │   │   ├── catalogos.ts     # tablas SRI (id, IVA, pagos) + validador cédula/RUC
│   │   │   ├── claveAcceso.ts   # clave 49 dígitos, módulo 11
│   │   │   ├── facturaXml.ts    # XML <factura> v1.1.0
│   │   │   ├── firmaXades.ts    # firma XAdES-BES con el .p12
│   │   │   ├── soapClient.ts    # WS Recepción + Autorización
│   │   │   └── procesoEmision.ts# orquestador completo + reintentos
│   │   ├── pdf/ride.ts      # RIDE PDF (logo, código de barras, firma física)
│   │   └── export/excel.ts  # .xlsx (3 hojas) + .csv
│   ├── app/
│   │   ├── page.tsx             # ⭐ Dashboard: grid de habitaciones
│   │   ├── login/                # login por usuario, fondo/logo según hora del día
│   │   ├── facturar/[id]/       # formulario de facturación
│   │   ├── facturas/            # listado + estado SRI + PDF + reintento
│   │   ├── gastos/               # registro de gastos + gastos/xml (importar XML de proveedores)
│   │   ├── reservas/             # reservas importadas de Airbnb (iCal)
│   │   ├── ocupacion/            # calendario habitación × día (Airbnb + directas), holds manuales
│   │   ├── caja/                 # caja diaria / cierre de turno
│   │   ├── bi/                   # 🔒 solo ADMIN — Insights (estilo Airbnb Host) + demografía CRM
│   │   ├── finanzas/             # dashboard financiero maestro + proyección de impuestos
│   │   ├── estadisticas/        # gráficas mes a mes
│   │   ├── integraciones/       # Airbnb iCal, Google Calendar, Google Sheets
│   │   ├── ajustes/             # direcciones (texto libre) + tarifas
│   │   └── api/                 # backend: facturas, gastos, ocupación, caja, bi, exportar…
│   └── components/          # Navegacion, FormularioFactura, PanelBI, PanelOcupacion, PanelCaja…
└── public/logo.png          # coloca aquí tu logo para el RIDE (opcional)
```

---

## 4. Reglas de negocio implementadas

- **Habitaciones:** H2 (1 matrimonial), H3 + H4 (espacio compartido; H4: 1M+1S+2 literas), H5 (1M+1S), H6 (1M), H7 (1M+1S+1 litera). Capacidad = 2×matrimonial + 1×simple + 2×litera.
- **Precio por habitación** (tarifa plana × noches) **o por persona** (huéspedes × tarifa × noches), con recálculo automático en vivo; opción de descuento y de precio pactado manual.
- Facturar el **espacio compartido 3-4 en una sola factura** (una línea por habitación).
- **Consumidor Final** con tope legal de $50 (bloqueado sobre ese monto), cédula validada con módulo 10, RUC con estructura.
- **Pago:** efectivo (01) o transferencia (20). Dirección del cliente: campo de texto manual.
- Los XML firmados se conservan en la base (obligación de archivo de 7 años).

## 5. Sincronización con tu Excel maestro de declaraciones

`GET /api/exportar?formato=xlsx` genera el libro con la hoja **Resumen Mensual** cuyas columnas están rotuladas con los casilleros del **Formulario 104** (ventas 15% → 411, ventas 0% → 413, IVA cobrado → 421…). Los CSV (`?formato=csv&tipo=ventas|gastos`) tienen encabezados estables, pensados para `Datos → Obtener datos → Desde CSV` en tu hoja maestra.

## 5.5 Módulos adicionales (CRM, cuentas por pagar, ocupación, caja)

- **CRM de clientes:** al autorizar una factura, el cliente (identificación, nombre, email, nacionalidad) se guarda/actualiza automáticamente para autocompletar la próxima vez que se hospede.
- **Cuentas por pagar (`/gastos/xml`):** sube los `.xml` de facturas recibidas de tus proveedores; el sistema los lee de forma nativa (sin APIs pagas), los muestra en una tabla editable (categoría + "deducible") y genera un resumen mensual + una exportación de referencia tipo ATS para agilizar la declaración manual en el SRI (el SRI no ofrece API para subir gastos directamente).
- **Google Sheets (opcional):** cada gasto marcado "deducible" se agrega, en segundo plano, a una hoja de Google configurada por cuenta de servicio (ver variables `GOOGLE_SERVICE_ACCOUNT_*` en `.env.example`). Si no está configurado, el sistema sigue funcionando igual (no bloquea nada).
- **Insights / BI (`/bi`, solo ADMIN):** dashboard estilo *Airbnb Host Insights* — ingresos por habitación, tendencia de ingresos y ocupación mes a mes (con comparación interanual), estadía promedio, y demografía (género, nacionalidad, segmento de viajero) cruzada con ingresos. Todo integrado en pantalla, sin depender de exportar CSV.
- **Ocupación (`/ocupacion`):** calendario habitación × día que cruza reservas de Airbnb (iCal), facturas ya emitidas y *holds* manuales (bloqueos para ventas directas antes de facturar). Crear un hold se rechaza si la habitación ya está ocupada esas fechas; el formulario de factura también avisa (sin bloquear) si hay un cruce.
- **Caja diaria (`/caja`):** cierre de turno que reconcilia el efectivo físico contado contra lo que el sistema espera (facturas en efectivo menos gastos en efectivo desde el cierre anterior), dejando un historial auditable de sobrantes/faltantes.

## 6. Escalabilidad prevista

- **PostgreSQL:** cambia `provider = "postgresql"` y la `DATABASE_URL`; Prisma migra el esquema tal cual.
- **Multi-establecimiento:** la tabla `Secuencial` ya es única por (establecimiento, punto de emisión, tipo).
- **Notas de crédito / retenciones:** replicar `facturaXml.ts` con los tipos 04/07 reutilizando clave, firma y SOAP tal cual.
- **Multi-propiedad:** el modelo `Habitacion` + `Reserva.fuente` ya soporta agregar otro alojamiento/canal (Booking, channel manager) reutilizando el mismo esquema.

## 7. Despliegue en producción

Dos formas de operar el sistema en el día a día. En ambas, **la emisión de facturas necesita internet** (llama a los Web Services SOAP del SRI); si no hay conexión, la factura queda `FIRMADA/ERROR_ENVIO` y se reintenta después (ventana legal de 72 horas).

### 7.1 VPS en la nube (recomendado — acceso desde cualquier lugar, 300-500 reservas/año)

Con este volumen, un droplet pequeño alcanza de sobra. No hace falta Kubernetes ni nada parecido: es una sola app Next.js + SQLite.

**Costo estimado:** droplet DigitalOcean de **$5-6/mes** (1 vCPU, 1 GB RAM) + dominio (`casamamaemma.com`, ~$12/año) + certificado TLS gratis (Let's Encrypt).

1. **Crear el droplet**
   - DigitalOcean (o Vultr/Linode, equivalentes) → Ubuntu 22.04 LTS → plan más económico ($5-6/mes).
   - Apunta el DNS de tu dominio (`casamamaemma.com` → registro `A`) a la IP del droplet.

2. **Preparar el servidor** (por SSH):
   ```bash
   sudo apt update && sudo apt upgrade -y
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs nginx git
   sudo npm install -g pm2          # mantiene la app viva y la reinicia si falla/reinicia el server
   ```

3. **Subir el código y configurar**
   ```bash
   git clone <tu-repositorio> /var/www/casa-mama-emma
   cd /var/www/casa-mama-emma
   npm install
   cp .env.example .env             # editar: AUTH_SECRET propio, APP_URL=https://casamamaemma.com,
                                     # credenciales del emisor, SRI_AMBIENTE=2 solo cuando esté validado
   npm run db:setup                 # crea la BD SQLite + usuarios (o usa PostgreSQL, ver sección 6)
   npm run build
   ```

4. **Certificado de firma (.p12):** súbelo por `scp` a `certificados/firma.p12` en el servidor (nunca lo subas al repositorio git). Ajusta `SRI_P12_PATH`/`SRI_P12_PASSWORD` en `.env`.

5. **Arrancar con PM2** (queda corriendo aunque cierres la sesión SSH, y se reinicia solo si el servidor reinicia):
   ```bash
   pm2 start npm --name casa-mama-emma -- start   # usa el script "start" → next start, puerto 3000
   pm2 save
   pm2 startup                                     # sigue la instrucción que imprime (systemd)
   ```

6. **Nginx como proxy inverso** (recibe el tráfico del puerto 80/443 y lo pasa al 3000; también sirve para Apache si lo prefieres, la idea es la misma):
   ```nginx
   # /etc/nginx/sites-available/casa-mama-emma
   server {
       listen 80;
       server_name casamamaemma.com www.casamamaemma.com;
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/casa-mama-emma /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

7. **HTTPS gratis con Let's Encrypt:**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d casamamaemma.com -d www.casamamaemma.com
   ```
   Certbot configura el certificado y la renovación automática.

8. **Respaldos:** la base SQLite es un solo archivo (`casa-mama-emma.db`). Automatiza una copia diaria fuera del servidor, por ejemplo:
   ```bash
   # crontab -e
   0 3 * * * cp /var/www/casa-mama-emma/casa-mama-emma.db /var/backups/casa-mama-emma-$(date +\%F).db
   ```
   (o sube esa copia a Google Drive/S3 con `rclone`). Los XML firmados viven dentro de la BD, así que respaldarla cubre también la obligación de archivo de 7 años del SRI.

9. **Actualizar la app** cuando haya cambios de código:
   ```bash
   cd /var/www/casa-mama-emma && git pull && npm install && npm run build && pm2 restart casa-mama-emma
   ```

**Alternativa con Docker** (si prefieres contenedores en el mismo droplet): construye una imagen `node:20-alpine`, copia el proyecto, corre `npm ci && npm run build`, expón el puerto 3000 con `CMD ["npm", "start"]`, y monta un volumen para `casa-mama-emma.db` y `certificados/` para que persistan entre reinicios del contenedor. Nginx + certbot en el host siguen igual, apuntando al puerto publicado del contenedor.

### 7.2 Localhost / red local (sin costo de hosting, solo accesible en el local)

Ideal si el hospedaje ya tiene una PC dedicada en recepción y no necesitas acceder desde fuera.

- **Sigue la sección 2** ("Puesta en marcha") tal cual, pero en vez de `npm run dev` usa producción real:
  ```bash
  npm run build
  npm run start           # o: pm2 start npm --name casa-mama-emma -- start
  ```
- **Para que otros dispositivos de la misma red (tablet en recepción, celular) accedan:** corre `npm run start -- -H 0.0.0.0` y entra desde `http://IP-DE-LA-PC:3000`. Dale una IP fija a esa PC en el router para que la URL no cambie.
- **⚠️ Importante — el internet SIGUE siendo obligatorio incluso en local:** aunque la app corra 100% en tu red local, **emitir facturas llama a los Web Services del SRI por internet** (WS Recepción/Autorización) y, si usas Google Sheets/Calendar/Airbnb iCal, esas integraciones también necesitan salida a internet. Localhost solo evita el costo de un VPS; no evita la dependencia de conexión para facturar.
- **Docker como alternativa a instalar Node localmente:** con Docker Desktop, construye la misma imagen descrita en 7.1 y corre `docker run -p 3000:3000 -v $(pwd)/casa-mama-emma.db:/app/casa-mama-emma.db -v $(pwd)/certificados:/app/certificados --env-file .env casa-mama-emma`. Útil si no quieres instalar Node.js directamente en la PC de recepción.
- **Respaldos:** copia periódicamente `casa-mama-emma.db` (y la carpeta `certificados/`) a un USB o a la nube — es un archivo único, no hay servidor de base de datos que respaldar aparte.

## ⚠️ Notas legales

- Prueba SIEMPRE en ambiente 1 antes de pasar a producción.
- Este sistema genera comprobantes; la responsabilidad de declarar (F104/F102) sigue siendo del contribuyente. Valida con tu contador la primera declaración tras el cambio a Régimen General.
