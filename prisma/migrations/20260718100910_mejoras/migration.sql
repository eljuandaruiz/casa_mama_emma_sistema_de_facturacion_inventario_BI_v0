-- CreateTable
CREATE TABLE "Mejora" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "area" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "costo" REAL NOT NULL DEFAULT 0,
    "numeroFactura" TEXT,
    "imagen" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Mejora_area_idx" ON "Mejora"("area");

-- CreateIndex
CREATE INDEX "Mejora_fecha_idx" ON "Mejora"("fecha");
