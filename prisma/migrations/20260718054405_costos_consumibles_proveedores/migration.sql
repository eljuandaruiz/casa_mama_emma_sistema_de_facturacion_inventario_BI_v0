-- CreateTable
CREATE TABLE "ConsumibleHabitacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numeroHabitacion" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL DEFAULT 1,
    CONSTRAINT "ConsumibleHabitacion_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "ArticuloInventario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProveedorArticulo" (
    "proveedorId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,

    PRIMARY KEY ("proveedorId", "articuloId"),
    CONSTRAINT "ProveedorArticulo_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProveedorArticulo_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "ArticuloInventario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ArticuloInventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'OTROS',
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "stock" REAL NOT NULL DEFAULT 0,
    "stockMinimo" REAL NOT NULL DEFAULT 0,
    "valorUnitario" REAL NOT NULL DEFAULT 0,
    "icono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ArticuloInventario" ("activo", "categoria", "creadoEn", "id", "nombre", "stock", "stockMinimo", "unidad") SELECT "activo", "categoria", "creadoEn", "id", "nombre", "stock", "stockMinimo", "unidad" FROM "ArticuloInventario";
DROP TABLE "ArticuloInventario";
ALTER TABLE "new_ArticuloInventario" RENAME TO "ArticuloInventario";
CREATE INDEX "ArticuloInventario_categoria_idx" ON "ArticuloInventario"("categoria");
CREATE TABLE "new_Factura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establecimiento" TEXT NOT NULL,
    "puntoEmision" TEXT NOT NULL,
    "secuencial" INTEGER NOT NULL,
    "numeroCompleto" TEXT NOT NULL,
    "fechaEmision" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ambiente" TEXT NOT NULL,
    "claveAcceso" TEXT NOT NULL,
    "estadoSri" TEXT NOT NULL DEFAULT 'GENERADA',
    "numeroAutorizacion" TEXT,
    "fechaAutorizacion" DATETIME,
    "mensajesSri" TEXT,
    "xmlFirmado" TEXT,
    "clienteId" INTEGER NOT NULL,
    "modoPrecio" TEXT NOT NULL,
    "huespedes" INTEGER NOT NULL DEFAULT 1,
    "noches" INTEGER NOT NULL DEFAULT 1,
    "checkIn" DATETIME,
    "checkOut" DATETIME,
    "subtotalSinImpuestos" REAL NOT NULL,
    "totalDescuento" REAL NOT NULL DEFAULT 0,
    "base15" REAL NOT NULL DEFAULT 0,
    "base8" REAL NOT NULL DEFAULT 0,
    "base0" REAL NOT NULL DEFAULT 0,
    "valorIva" REAL NOT NULL DEFAULT 0,
    "propina" REAL NOT NULL DEFAULT 0,
    "importeTotal" REAL NOT NULL,
    "formaPago" TEXT NOT NULL,
    "notaAdicional" TEXT,
    "costoConsumibles" REAL NOT NULL DEFAULT 0,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "motivoAnulacion" TEXT,
    "fechaAnulacion" DATETIME,
    "creadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Factura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Factura" ("ambiente", "anulada", "base0", "base15", "base8", "checkIn", "checkOut", "claveAcceso", "clienteId", "creadaEn", "establecimiento", "estadoSri", "fechaAnulacion", "fechaAutorizacion", "fechaEmision", "formaPago", "huespedes", "id", "importeTotal", "mensajesSri", "modoPrecio", "motivoAnulacion", "noches", "notaAdicional", "numeroAutorizacion", "numeroCompleto", "propina", "puntoEmision", "secuencial", "subtotalSinImpuestos", "totalDescuento", "valorIva", "xmlFirmado") SELECT "ambiente", "anulada", "base0", "base15", "base8", "checkIn", "checkOut", "claveAcceso", "clienteId", "creadaEn", "establecimiento", "estadoSri", "fechaAnulacion", "fechaAutorizacion", "fechaEmision", "formaPago", "huespedes", "id", "importeTotal", "mensajesSri", "modoPrecio", "motivoAnulacion", "noches", "notaAdicional", "numeroAutorizacion", "numeroCompleto", "propina", "puntoEmision", "secuencial", "subtotalSinImpuestos", "totalDescuento", "valorIva", "xmlFirmado" FROM "Factura";
DROP TABLE "Factura";
ALTER TABLE "new_Factura" RENAME TO "Factura";
CREATE UNIQUE INDEX "Factura_numeroCompleto_key" ON "Factura"("numeroCompleto");
CREATE UNIQUE INDEX "Factura_claveAcceso_key" ON "Factura"("claveAcceso");
CREATE INDEX "Factura_fechaEmision_idx" ON "Factura"("fechaEmision");
CREATE INDEX "Factura_estadoSri_idx" ON "Factura"("estadoSri");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ConsumibleHabitacion_numeroHabitacion_articuloId_key" ON "ConsumibleHabitacion"("numeroHabitacion", "articuloId");
