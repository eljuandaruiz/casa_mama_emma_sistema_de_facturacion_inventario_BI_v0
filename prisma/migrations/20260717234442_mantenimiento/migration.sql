-- CreateTable
CREATE TABLE "TrabajoMantenimiento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "descripcionGeneral" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tiempoInvertido" TEXT,
    "responsable" TEXT,
    "supervisor" TEXT,
    "numerosFactura" TEXT,
    "inventarioConsumido" TEXT,
    "materialSobrante" TEXT,
    "itemsCosto" TEXT NOT NULL DEFAULT '[]',
    "costoTotal" REAL NOT NULL DEFAULT 0,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FotoMantenimiento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trabajoId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "imagen" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "FotoMantenimiento_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "TrabajoMantenimiento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TrabajoMantenimiento_fecha_idx" ON "TrabajoMantenimiento"("fecha");
