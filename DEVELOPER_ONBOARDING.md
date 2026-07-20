# Guía de incorporación para desarrolladores — Casa Mamá Emma ERP/CRM

Documento para el desarrollador que **mantiene o amplía** este sistema. Explica
el flujo interno de datos, el manejo de estado, cómo funciona el algoritmo de
costos, y **reglas estrictas para no romper la lógica contable**.

> Lee también `DOCUMENTACION.md` (arquitectura general y despliegue). Este
> documento es el manual técnico interno.

---

## 1. Filosofía del proyecto

- **Un solo proyecto full-stack** (Next.js App Router). UI y API viven juntas.
- **Prisma** es la única puerta a la base de datos. No hay SQL manual.
- **TypeScript estricto**: `npx tsc --noEmit` debe dar `EXIT 0` antes de cada commit.
- **Cero dependencias innecesarias**: PDFs con pdfmake, iconos SVG inline,
  parser iCal propio, cliente Google por `fetch`. No añadas librerías pesadas
  sin una razón fuerte.
- **El dinero se calcula en centavos** (`src/lib/money.ts`) y se redondea a 2
  decimales. Nunca sumes floats de dólares directamente en lógica nueva.

---

## 2. Flujo de datos (de la UI a la base de datos)

```
Componente cliente (Panel*.tsx / Formulario*.tsx)
        │  fetch('/api/...')
        ▼
Ruta API (src/app/api/**/route.ts)
        │  1. Zod valida el body  → error 400 con MENSAJE DESCRIPTIVO
        │  2. Lógica de negocio (src/lib/**)
        │  3. Prisma escribe/lee
        ▼
Base de datos (SQLite vía Prisma)
```

- **Server Components** (páginas `page.tsx`) leen datos directo con Prisma y
  aplican la guarda de rol (`requiereRol`).
- **Client Components** (`'use client'`) manejan estado con `useState`/`useMemo`
  y hablan con la API por `fetch`. No hay Redux ni librería de estado global:
  el estado vive en el componente y el servidor es la fuente de verdad.
- **El middleware** (`src/middleware.ts`) protege TODO: si una ruta no está en
  las listas públicas, exige sesión y valida el rol contra `lib/auth/roles.ts`.

---

## 3. Autenticación y roles (RBAC)

- La sesión es una **cookie firmada con HMAC** (`src/lib/auth/sesion.ts`),
  HttpOnly, 8 h. El payload lleva `uid`, `email`, `nombre`, `rol`.
- **`src/lib/auth/roles.ts` es la fuente única de permisos.** Para dar acceso a
  una ruta nueva, añádela a `PERMISOS_RUTA` (páginas) y `PERMISOS_API` (API).
  Si no la añades, queda accesible para cualquier usuario autenticado.
- 3 roles: `ADMIN`, `FACTURADOR`, `OPERACIONES`. Para cambiar qué ve un rol,
  edita solo ese archivo — el middleware y la navegación lo respetan automáticamente.

**Regla:** nunca confíes en el frontend para permisos. La guarda real está en el
middleware y en `requiereRol()` de las páginas.

---

## 4. El algoritmo de costos (⚠️ NO ROMPER)

Esta es la parte más delicada. Tres piezas calculan la **utilidad bruta por
estadía**:

### 4.1 Costos variables (consumibles) — al emitir la factura

En `src/lib/sri/procesoEmision.ts`, tras crear la factura:

1. Se buscan los `ConsumibleHabitacion` de las habitaciones facturadas (más los
   de `numeroHabitacion = 0`, que aplican a cualquier habitación).
2. Por cada uno se **descuenta del stock** (`ArticuloInventario.stock`) y se
   registra un `MovimientoInventario` (SALIDA).
3. Se acumula el **costo monetario** (`cantidad × valorUnitario`) y se guarda en
   `Factura.costoConsumibles`.

> **Regla:** este bloque está envuelto en `try/catch` para que un fallo de
> inventario **nunca bloquee la emisión de la factura**. Si lo modificas,
> mantén esa garantía: la factura legal es lo primero.

### 4.2 Costos fijos (prorrateo) — al calcular rentabilidad

En `src/app/api/finanzas/rentabilidad/route.ts`:

```
totalFijo         = Σ gastos del mes con categoría SERVICIOS_BASICOS / FIJOS_UTILIDADES
costoFijoPorFactura = totalFijo / nFacturas_del_mes   (reparto equitativo)
```

El reparto es **equitativo por factura**. Si en el futuro se quiere prorratear
por noches, cambia el divisor por el total de noches del mes y multiplica por
las noches de cada factura. **Documenta el cambio** — afecta la utilidad reportada.

### 4.3 Utilidad bruta por factura

```
utilidadBruta = ingresoNeto − costoConsumibles − costoFijoProrrateado
```

Donde `ingresoNeto = Factura.subtotalSinImpuestos` (sin IVA, que no es ingreso
propio sino un tributo que se traslada al SRI).

> **Regla de oro:** el IVA **nunca** es ingreso ni costo del negocio. No lo
> mezcles en los cálculos de utilidad. El margen se calcula sobre la base sin
> impuestos.

---

## 5. Facturación electrónica (flujo SRI)

`src/lib/sri/procesoEmision.ts` orquesta todo. NO reordenes estos pasos:

1. Reservar secuencial (atómico, sin huecos).
2. Clave de acceso (49 dígitos, módulo 11).
3. Construir XML.
4. Descontar consumibles (§4.1).
5. Firmar XAdES-BES.
6. Enviar a Recepción → consultar Autorización.

- El **modo de precio** está en `src/lib/pricing.ts`. El modo `AIRBNB` calcula
  hacia atrás: precio plataforma − comisión = neto (que YA incluye IVA), y de
  ahí extrae la base. Si tocas esto, corre los tests de `pricing` mentalmente:
  `base + IVA` debe ser **exactamente** igual al neto recibido.
- La **nota/disclaimer** de la factura vive en `Factura.notaAdicional` y se
  imprime en el RIDE y el ticket. El texto legal de Airbnb es fijo — no lo edites
  sin autorización del negocio.

---

## 6. Generación de PDF

Tres generadores en `src/lib/pdf/`, todos con **pdfmake**:

- `ride.ts` — factura A4 (RIDE) con código de barras.
- `ticket.ts` — comprobante térmico 80 mm.
- `mantenimiento.ts` — **dúplex con paginación DINÁMICA**.

### Cómo funciona la paginación dúplex dinámica (`mantenimiento.ts`)

- Las fotos se agrupan en **bloques de 6** (3 filas × 2 columnas).
- Por cada bloque se generan **2 páginas**: una de fotos (cara A) y una de
  descripciones **espejadas por columna** (`.reverse()` por fila) para que, al
  imprimir a doble cara por el borde largo, cada texto quede detrás de su foto.
- El patrón se repite por cada bloque ⇒ **sin límite de fotos**.

> Si cambias `FOTOS_POR_PAGINA` o `COLUMNAS`, verifica que el espejo siga
> alineado (el `.reverse()` depende del número de columnas).

---

## 7. Nombres de archivo de los PDF

Convención (no la rompas, el negocio ordena archivos por ella):

- Factura A4: `numero_fecha_TIPO-nombre_habN_Xp_G_Yusd.pdf`
- Ticket: `Ticket_numero_fecha_ID_nombre_habN_estadia_total.pdf`

`TIPO` = CI / P / RUC / CF. Las fechas usan `src/lib/fechas.ts` (mes en texto).

---

## 8. Cómo añadir un módulo nuevo (receta)

1. **Schema**: añade el modelo en `prisma/schema.prisma`. Comenta las relaciones.
2. `npx prisma migrate dev --name mi_modulo` (detén el server dev antes: el
   motor de Prisma se bloquea en Windows si hay un `next dev` corriendo).
3. **API**: `src/app/api/mi-modulo/route.ts` con validación Zod y mensajes
   descriptivos.
4. **RBAC**: añade la ruta a `src/lib/auth/roles.ts`.
5. **Página**: `src/app/mi-modulo/page.tsx` (Server Component, `requiereRol`).
6. **Componente**: `src/components/PanelMiModulo.tsx` (`'use client'`).
7. **Navegación**: añade el enlace a `src/components/Navegacion.tsx`.
8. `npx tsc --noEmit` → EXIT 0. Prueba end-to-end antes de dar por hecho.

---

## 9. Errores y validación

- **Prohibido** el mensaje genérico "Datos inválidos" de cara al usuario cuando
  se puede ser específico. Usa `validarIdentificacion` / `validarTelefono` de
  `src/lib/sri/catalogos.ts`, que devuelven `{ ok, error }` con el motivo exacto.
- Los umbrales (21 huéspedes, $3000) piden **confirmación explícita** en el
  frontend (`window.confirm`) antes de abrir el modal de verificación.

---

## 10. Entorno de desarrollo (Windows)

- `npm run dev` levanta el server. En Windows, **detén `node` antes de correr
  migraciones de Prisma** (`Get-Process node | Stop-Process -Force`), o el motor
  da error `EPERM`.
- Scripts de prueba/verificación: crea `.mts` temporales en la raíz (para que
  resuelvan `@prisma/client`), impórtale `PrismaClient` directo, y bórralos al
  terminar.
- Datos de prueba: límpialos siempre (las facturas `ERROR_FIRMA` no son reales).

---

## 11. Checklist antes de tocar la contabilidad

Si vas a modificar precios, IVA, costos o prorrateo:

- [ ] ¿El IVA sigue fuera de los cálculos de utilidad?
- [ ] ¿`base + IVA == total` en todos los modos de precio?
- [ ] ¿El descuento de inventario sigue en `try/catch` (no bloquea la factura)?
- [ ] ¿Los montos se redondean a 2 decimales con `round2`?
- [ ] ¿Corriste una emisión de prueba y revisaste `costoConsumibles` en la DB?
- [ ] ¿`npx tsc --noEmit` da EXIT 0?
