-- CreateTable
CREATE TABLE "Obligacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'IMPUESTO',
    "proximoVencimiento" DATETIME NOT NULL,
    "recurrencia" TEXT NOT NULL DEFAULT 'ANUAL',
    "entidad" TEXT,
    "notas" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "ultimoPago" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Obligacion_proximoVencimiento_idx" ON "Obligacion"("proximoVencimiento");
