-- CreateTable
CREATE TABLE "ArticuloInventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'OTROS',
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "stock" REAL NOT NULL DEFAULT 0,
    "stockMinimo" REAL NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "articuloId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "motivo" TEXT,
    "stockResultante" REAL NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoInventario_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "ArticuloInventario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ArticuloInventario_categoria_idx" ON "ArticuloInventario"("categoria");

-- CreateIndex
CREATE INDEX "MovimientoInventario_creadoEn_idx" ON "MovimientoInventario"("creadoEn");
