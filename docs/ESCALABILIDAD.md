# 🔀 Guía de escalabilidad — de Casa Mamá Emma a otros negocios

Este sistema está construido en capas separables. El **núcleo reutilizable** no sabe
nada de "hospedaje": firma XAdES-BES, clave de acceso módulo 11, XML `<factura>` v1.1.0,
SOAP Recepción/Autorización, RIDE PDF, RBAC, sesiones, catálogo de productos, gastos,
Google Sheets/Calendar. Eso es ~70% del código y sirve para CUALQUIER negocio que
facture por el SRI en Ecuador.

## Qué se reutiliza tal cual (no tocar)

| Capa | Archivos | Nota |
|---|---|---|
| Motor SRI completo | `src/lib/sri/*` | firma, clave, XML, SOAP, orquestador |
| RIDE PDF | `src/lib/pdf/ride.ts` | cambia logo y nombre comercial vía `.env` |
| Autenticación + roles | `src/lib/auth/*`, `src/middleware.ts` | bloqueo 10 intentos/8 h, recuperación por correo |
| Catálogo de productos | `Producto` + `/productos` + `/api/productos` | ⭐ la pieza central para negocios de venta |
| Gastos / cuentas por pagar | `/gastos`, lector XML nativo | idéntico en cualquier RUC |
| Google Sheets/Calendar/Docs automáticos | `src/lib/googleSheets.ts`, `src/lib/integraciones/google.ts` | cuentas de servicio y OAuth ya resueltos |
| Dinero seguro | `src/lib/money.ts` | centavos + redondeo SRI |

## Qué es específico del hospedaje (lo que se reemplaza)

`Habitacion`, `Reserva`, `Ocupacion`, `PerfilHuesped`, `pricing.ts` (por habitación/persona),
portal del huésped, iCal de Airbnb. Todo lo demás queda.

---

## A) Diamond Print — imprenta DTF (tema oscuro) ⭐ prioridad

**Modelo de negocio:** venta de impresiones DTF por metro/diseño + productos.

1. **Clonar** el repo → nuevo `.env` con el RUC de Diamond Print y su `.p12`.
2. **Reemplazar el catálogo:** los "productos" DTF viven en la tabla `Producto` que ya
   existe (`DTF-METRO`, `DTF-DISENO`, `PLANCHADO`, etc.) con su IVA. La factura se
   emite eligiendo productos del catálogo (ya implementado como "extras" de un clic).
3. **Quitar módulos de hospedaje:** eliminar rutas `/reservas`, `/ocupacion`, `/portal`,
   `/bi` (o adaptarlo), y el bloque de habitaciones del formulario de factura — la vía
   rápida es un formulario nuevo `FormularioVenta.tsx` que solo usa catálogo + cliente
   (el 90% del actual `FormularioFactura` sin la sección de estadía).
4. **Pedidos:** el modelo `SolicitudHuesped` se renombra conceptualmente a "Pedido"
   (cliente deja diseño + medidas por el portal público → bandeja interna → facturar).
5. **TEMA OSCURO (todo negro):** en `tailwind.config.ts` añade `darkMode: 'class'` y en
   `src/app/layout.tsx` pon `<html lang="es" className="dark">`. Define la paleta:
   ```ts
   // tailwind.config.ts → theme.extend.colors
   fondo:   '#0a0a0a',   // negro base
   panel:   '#161616',   // tarjetas
   borde:   '#262626',
   acento:  '#e5e5e5',   // texto principal
   marca:   '#a3a3a3',   // gris Diamond Print (o el color de su marca)
   ```
   y en `globals.css` cambia las clases utilitarias `tarjeta`, `campo`, `btn-*`
   a sus variantes oscuras. Un solo archivo controla el look completo.
6. **Tipografía sobre emojis (estilo Apple):** el sidebar acepta grupos sin iconos —
   deja `icono: ''` y sube el peso tipográfico (`font-semibold`, jerarquía por tamaño
   y negrilla, como en las facturas). Recomendado para el tema oscuro de Diamond Print.

## B) Consultorio médico — recetas y pacientes

1. `Habitacion` → **`Paciente`** (cédula, nombre, fecha nacimiento, alergias).
2. `PerfilHuesped` → **`HistoriaClinica`** (1:N con Paciente; el patrón demografía+notas ya está).
3. Nuevo modelo **`Receta`**: `pacienteId`, `fecha`, `diagnostico`, `medicamentos` (JSON:
   fármaco/dosis/frecuencia/duración), `indicaciones`, `proximaCita`.
   - El generador PDF de la receta se copia de `src/lib/pdf/ride.ts` (misma librería
     pdfmake, mismo patrón de layout, membrete de la doctora).
   - `proximaCita` se sincroniza a Google Calendar reutilizando el módulo **Tareas** tal cual.
4. La facturación de consultas usa `Producto` (`CONSULTA`, `CONTROL`, …) — servicios
   médicos suelen ser IVA 0% (código "0" ya soportado).
5. ⚠️ Datos de salud = sensibles: mantener la app SOLO en red local o detrás de
   Cloudflare Access, y respaldos cifrados.

## C) Vulcano Shoes — venta de calzado (trabajo/montaña/casual)

1. **`Producto` es el centro:** cada zapato = un producto (`ZAP-TRAB-42`,
   `ZAP-MONT-40`…). Se puede añadir `talla` y `categoria` al modelo con una migración
   pequeña, o codificarlas en el código/descripcion.
2. **Inventario ya resuelto:** `ArticuloInventario` + movimientos ENTRADA/SALIDA +
   alertas de stock mínimo funcionan tal cual para pares de zapatos; la relación
   `ProveedorArticulo` ya existe para saber a quién recomprar.
3. La página web pública de Vulcano puede consumir `GET /api/productos` como catálogo
   JSON (misma base de datos, cero duplicación).
4. Facturación, gastos, caja diaria, finanzas, documentos automáticos: idénticos.

---

## Seguridad (aplica a todos los forks)

- **SQL injection: no hay superficie.** El 100% del acceso a datos pasa por Prisma,
  que genera consultas parametrizadas — no existe NI UNA consulta cruda
  (`$queryRaw`/`$executeRaw`) en el código. Nunca concatenes SQL a mano; si algún día
  necesitas SQL crudo, usa `prisma.$queryRaw` con template literals (parametriza solo).
- **Validación de entrada:** toda ruta API valida con Zod antes de tocar la BD o el SRI.
- **Sesiones:** cookie httpOnly firmada HMAC-SHA256, expira a las 8 h, `secure` en producción.
- **Fuerza bruta:** 10 intentos fallidos → cuenta bloqueada 8 horas; mensajes de error
  que no revelan si el usuario existe (anti-enumeración), también en la recuperación
  de contraseña.
- **XSS:** React escapa todo por defecto; no se usa `dangerouslySetInnerHTML`.
- **Secretos:** viven en `.env` (fuera de git); el `.p12` en `certificados/` (ignorado).

## Logotipo (SVG) — dónde va

| Uso | Ubicación | Cómo |
|---|---|---|
| Logo de la app (login, sidebar) | `src/components/Logo.tsx` | Es un componente SVG **inline** con 3 variantes de color según la hora (día/tarde/noche). Para usar tu SVG definitivo: reemplaza los `<path>` internos del componente conservando la prop `variante`, O guarda `public/logo.svg` y cambia el componente por `<img src="/logo.svg" …>`. |
| Logo impreso en la factura (RIDE) | `public/logo.png` | El PDF usa PNG (pdfmake no rasteriza SVG): exporta tu SVG a PNG de ~600px de ancho y guárdalo con ese nombre exacto. Si no existe, el RIDE deja el espacio reservado. |
| Favicon / ícono de pestaña | `src/app/favicon.ico` | Convierte el SVG a `.ico` (32×32). |

## Idiomas (i18n)

El patrón ya está montado en el portal del huésped (`FormularioPortal.tsx`):
diccionario `T` por idioma + `nacionalidades(idioma)` que se **reordena
alfabéticamente sola** según el locale (`localeCompare`). Para llevar toda la app a
multi-idioma: extraer los diccionarios a `src/lib/i18n/` (uno por pantalla), guardar
el idioma en una cookie y leerlo en el layout. Añadir un idioma = añadir una columna
de textos; el orden alfabético de listas se resuelve automáticamente.
