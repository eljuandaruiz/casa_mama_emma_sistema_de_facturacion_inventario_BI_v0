# Casa Mamá Emma — ERP/CRM de hospedaje
### Documentación técnica y guía de despliegue

Sistema de **gestión, facturación electrónica (SRI Ecuador) y operación** para
el hospedaje *Casa Mamá Emma* (Baños de Agua Santa). Actúa como un ERP/CRM
ligero: facturación, reservas, inventario, mantenimiento, compras/activos,
finanzas y BI.

---

## 1. Stack tecnológico

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Framework | **Next.js 14 (App Router)** | Full-stack (UI + API en un solo proyecto), SSR, rutas por archivos |
| Lenguaje | **TypeScript** (estricto) | Seguridad de tipos en todo el sistema |
| Base de datos | **SQLite** vía **Prisma ORM** | Cero configuración; migrable a PostgreSQL cambiando el `provider` |
| Estilos | **Tailwind CSS** | UI responsive rápida (escritorio + móvil) |
| PDF | **pdfmake** + **bwip-js** | RIDE (factura A4), ticket térmico, PDF dúplex de mantenimiento, código de barras |
| Firma SRI | **node-forge** (XAdES-BES sobre `.p12`) | Firma electrónica de comprobantes |
| Gráficos | **Recharts** | Dashboards de finanzas y BI |
| Auth | Cookie de sesión firmada (**HMAC**) + **bcryptjs** | Sesiones seguras sin dependencias pesadas |

---

## 2. Cómo correr el proyecto (local)

```bash
# 1. Instalar dependencias
npm install

# 2. Generar el cliente Prisma
npm run db:generate       # = prisma generate

# 3. Crear la base de datos y sembrar datos base
npm run db:setup          # = prisma migrate dev + tsx prisma/seed.ts

# 4. Levantar el servidor de desarrollo
npm run dev               # http://localhost:3000
```

### Usuarios sembrados (cambiar contraseñas en producción)

| Rol | Correo | Contraseña | Ve |
|-----|--------|-----------|-----|
| **ADMIN** | admin@casamamaema.com | CambiarClave123 | Todo |
| **FACTURADOR** | facturador@casamamaema.com | Facturador123 | Facturas, reservas, portal |
| **OPERACIONES** | operaciones@casamamaema.com | Operaciones123 | Inventario, mantenimiento, reparaciones, compras |

---

## 3. Variables de entorno (`.env`)

```env
# Base de datos
DATABASE_URL="file:./casa-mama-emma.db"

# Emisor SRI (datos reales del negocio)
SRI_RUC="1805034426001"
SRI_RAZON_SOCIAL="RUIZ JARA JUAN DAVID"
SRI_NOMBRE_COMERCIAL="Casa Mamá Emma"
SRI_AMBIENTE="1"                       # 1=pruebas, 2=producción
SRI_P12_PATH="./certificados/firma.p12"
SRI_P12_PASSWORD="clave-del-certificado"

# Autenticación
AUTH_SECRET="<secreto-largo-y-único>"  # openssl rand -base64 32
ADMIN_EMAIL="admin@casamamaema.com"
ADMIN_PASSWORD="CambiarClave123"

# Integraciones
APP_URL="https://casamamaemma.com"
GOOGLE_CLIENT_ID=""                     # OAuth Google Calendar (opcional)
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="https://casamamaemma.com/api/integraciones/google/callback"
```

---

## 4. Arquitectura de carpetas

```
src/
  app/
    page.tsx                 Dashboard: selector de habitaciones + avisos
    login/                   Inicio de sesión
    facturar/                Emisión de facturas (por habitación, grupos, por número)
    facturas/                Lista de facturas (PDF, ticket, compartir, anular)
    reservas/                Reservas importadas de Airbnb (iCal)
    solicitudes/             Bandeja del portal de huéspedes
    portal/                  Vista PÚBLICA del huésped (sin login)
    inventario/              Stock de amenidades/consumibles
    mantenimiento/           Reportes con fotos + PDF dúplex A4
    reparaciones/            Solicitudes con matriz de Eisenhower + Google Calendar
    compras/                 Compras y activos con depreciación
    proveedores/             Directorio de proveedores
    finanzas/                Dashboard financiero maestro (ADMIN)
    estadisticas/            Reportes mensuales (ADMIN)
    bi/                      BI/CRM demográfico oculto (ADMIN)
    obligaciones/            Recordatorios de impuestos
    usuarios/                Gestión de usuarios y roles (ADMIN)
    integraciones/           Airbnb iCal + Google Calendar (ADMIN)
    ajustes/                 Configuración del emisor
    api/                     Endpoints REST equivalentes a cada módulo
  components/                Componentes de UI (Panel*, Formulario*, etc.)
  lib/
    auth/                    RBAC (roles.ts), sesión HMAC (sesion.ts), guardas (servidor.ts)
    sri/                     XML, clave de acceso, firma XAdES, SOAP, catálogos SRI
    pdf/                     ride.ts (factura), ticket.ts (térmico), mantenimiento.ts (dúplex)
    integraciones/           ical.ts (Airbnb), google.ts (Calendar)
    pricing.ts               Lógica de precios (habitación/persona/casa completa/AIRBNB)
    depreciacion.ts          Depreciación línea recta (reglamento EC)
    areas.ts                 Áreas físicas de la propiedad
    eisenhower.ts            Matriz de priorización
    obligaciones.ts          Cuenta regresiva de impuestos
prisma/
  schema.prisma             Modelo de datos completo
  seed.ts                   Datos iniciales
certificados/               Almacén del .p12 (ignorado por git)
```

---

## 5. Modelo de datos y relaciones (Prisma)

Entidades principales y cómo se conectan:

- **Habitacion** → `DetalleFactura` (una habitación aparece en muchos detalles).
- **Cliente** → `Factura` (un cliente tiene muchas facturas).
- **Factura** → `DetalleFactura` (1:N) y `PerfilHuesped` (1:1, datos BI).
- **Factura.notaAdicional**: nota impresa en el RIDE (p. ej. desglose Airbnb).
- **Secuencial**: numeración legal atómica por punto de emisión.
- **Usuario**: credenciales + rol (ADMIN/FACTURADOR/OPERACIONES).
- **SolicitudHuesped**: bandeja del portal público → precarga la factura.
- **Reserva**: importada de Airbnb (idempotente por `uid` del iCal).
- **ArticuloInventario** → `MovimientoInventario` (entradas/salidas de stock).
- **TrabajoMantenimiento** → `FotoMantenimiento` (1:N); `area` liga a un espacio físico.
- **SolicitudReparacion**: foto + prioridad Eisenhower + fecha límite (→ Google Calendar).
- **Compra** → `Proveedor` (N:1); depreciación calculada al vuelo.
- **Obligacion**: impuestos con vencimiento (cuenta regresiva).
- **Integraciones**: fila única con la URL iCal de Airbnb y el refresh token de Google.

> Montos monetarios: se calculan en **centavos** (ver `lib/money.ts`) y se
> redondean a 2 decimales para evitar errores de coma flotante.

---

## 6. Lógica de negocio clave

### 6.1 Precios (`lib/pricing.ts`)

Cuatro modos:
- **HABITACION**: tarifa plana por noche.
- **PERSONA**: huéspedes × tarifa × noches.
- **CASA_COMPLETA**: todas las habitaciones en una línea agrupada.
- **AIRBNB**: el precio publicado en Airbnb **incluye IVA**; se resta la
  comisión de la plataforma (15.5% por defecto) y el **neto recibido** es lo
  que se factura, extrayendo la base con `base = total / (1 + IVA/100)`.
  El RIDE lleva una **nota** explicando el desglose.

### 6.2 Validación de identificación (`lib/sri/catalogos.ts`)

Algoritmo del dígito verificador (módulo 10 para cédula y RUC de persona
natural). Rechaza explícitamente dummies (`0000000000`, `2222222222`,
`1234567890`) tanto en frontend como backend.

### 6.3 Depreciación (`lib/depreciacion.ts`)

Línea recta con los porcentajes del Reglamento a la LORTI (muebles 10%/10 años,
cómputo 33%/3 años, vehículos 20%/5 años, inmuebles 5%/20 años). Los
consumibles no se deprecian (gasto del período).

### 6.4 Impuestos (`lib/obligaciones.ts` + `/api/finanzas`)

- Vencimiento de declaraciones según el **noveno dígito del RUC**
  (1805034426**0**01 → dígito 2 → día 12).
- Aviso en el dashboard **desde 1 mes antes**.
- Proyección de IVA a pagar (IVA cobrado − IVA en gastos) y renta estimada.

---

## 7. Facturación electrónica SRI (esquema offline)

Flujo en `lib/sri/procesoEmision.ts`:

1. Reservar secuencial (transacción atómica, sin huecos).
2. Generar clave de acceso (49 dígitos, módulo 11).
3. Construir XML `<factura>` v1.1.0.
4. Firmar XAdES-BES con el `.p12`.
5. Enviar al WS de Recepción → RECIBIDA/DEVUELTA.
6. Consultar WS de Autorización → AUTORIZADO/NO AUTORIZADO.
7. Persistir estados, mensajes y XML firmado (se conserva 7 años).

> **Certificado `.p12`**: se sube manualmente a `certificados/` (ver
> `certificados/LEEME.md`). Sin él, las facturas se generan y numeran pero
> quedan en `ERROR_FIRMA`; al instalarlo, el flujo se completa.

---

## 8. Roles y seguridad (RBAC)

Definición única en `lib/auth/roles.ts`, aplicada por `middleware.ts`:

- **Cookie de sesión** firmada con HMAC-SHA256 (`lib/auth/sesion.ts`),
  HttpOnly, expira a las 8 h.
- Contraseñas con **bcrypt**.
- El middleware protege páginas (redirige a `/login`) y API (401/403).
- Rutas públicas: `/login`, `/portal`, `/api/portal`.

---

## 9. Guía de despliegue a producción

### 9.1 Comprar el dominio (casamamaemma.com)

1. Registrarlo en un registrador (Namecheap, GoDaddy, Cloudflare Registrar).
2. Cloudflare Registrar es el más económico (precio a costo) y te da DNS + CDN.

### 9.2 Elegir hosting

La generación de PDF (pdfmake) consume RAM; conviene **mínimo 2 GB**.

| Opción | Recomendación |
|--------|---------------|
| **VPS** (Hetzner CX22, DigitalOcean, Vultr) | ✅ **Recomendado**: 2–4 GB RAM, control total, ~5–12 USD/mes. Ideal por la RAM de PDF y por poder subir el `.p12` de forma segura. |
| Railway / Render | Fácil, pero vigilar límites de RAM del plan |
| Vercel | Práctico para Next.js, pero las funciones serverless tienen límites de RAM/tiempo que complican PDF pesados y el almacenamiento del `.p12` |

### 9.3 Pasos en un VPS (Ubuntu)

```bash
# 1. Node 20 + pm2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2

# 2. Clonar y construir
git clone <repo> && cd casa-mama-emma
npm install
# Migrar a PostgreSQL en producción (recomendado): cambiar provider/url y:
npx prisma migrate deploy
npx prisma generate
npm run build

# 3. Subir el certificado .p12 por SFTP a ./certificados/firma.p12
#    y completar .env (AUTH_SECRET, SRI_*, GOOGLE_*)

# 4. Arrancar con pm2
pm2 start "npm run start" --name casa-mama-emma
pm2 save && pm2 startup
```

### 9.4 DNS (en el panel del dominio)

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | @ | IP-del-VPS |
| A | www | IP-del-VPS |

Luego un **reverse proxy** (Nginx o Caddy) con **HTTPS**:

```nginx
server {
  server_name casamamaemma.com www.casamamaemma.com;
  location / { proxy_pass http://localhost:3000; proxy_set_header Host $host; }
}
```

```bash
sudo certbot --nginx -d casamamaemma.com -d www.casamamaemma.com
```

> HTTPS es **obligatorio** para que funcione el botón Compartir (Web Share API)
> y el flujo OAuth de Google.

### 9.5 Subir el logo y assets

- El logo es **SVG inline** (`components/Logo.tsx`), no requiere subida.
- Para un logo en el RIDE, coloca `public/logo.png` (lo detecta automáticamente).

### 9.6 Configurar integraciones en producción

1. **Google Calendar**: crea credenciales OAuth en Google Cloud Console con la
   URI de redirección `https://casamamaemma.com/api/integraciones/google/callback`
   y pégalas en `.env`. Luego conéctate desde `/integraciones`.
2. **Airbnb**: copia tu URL iCal desde Airbnb → Calendario → "Conectar con
   otro sitio web" y pégala en `/integraciones`.

---

## 10. Respaldos

- **SQLite**: respalda el archivo `casa-mama-emma.db` a diario (es tu contabilidad).
- **PostgreSQL**: `pg_dump` programado.
- Los **XML firmados** de las facturas se guardan en la BD y deben conservarse
  **7 años** por ley.

---

## 11. Checklist antes de producción

- [ ] Cambiar todas las contraseñas sembradas.
- [ ] Generar un `AUTH_SECRET` único.
- [ ] Subir el `.p12` real y poner `SRI_AMBIENTE="2"` sólo tras validar en pruebas.
- [ ] Migrar a PostgreSQL si se espera alta concurrencia.
- [ ] Configurar HTTPS y respaldos automáticos.
- [ ] Verificar las fechas de las obligaciones tributarias según tu RUC.
```
