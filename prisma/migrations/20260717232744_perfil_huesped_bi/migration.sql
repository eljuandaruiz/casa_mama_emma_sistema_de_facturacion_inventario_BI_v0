-- CreateTable
CREATE TABLE "PerfilHuesped" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "facturaId" TEXT NOT NULL,
    "genero" TEXT,
    "edad" INTEGER,
    "nacionalidad" TEXT,
    "paisResidencia" TEXT,
    "profesion" TEXT,
    "estadoRelacion" TEXT,
    "segmentoViajero" TEXT,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "PerfilHuesped_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PerfilHuesped_facturaId_key" ON "PerfilHuesped"("facturaId");

-- CreateIndex
CREATE INDEX "PerfilHuesped_genero_idx" ON "PerfilHuesped"("genero");

-- CreateIndex
CREATE INDEX "PerfilHuesped_segmentoViajero_idx" ON "PerfilHuesped"("segmentoViajero");

-- CreateIndex
CREATE INDEX "PerfilHuesped_nacionalidad_idx" ON "PerfilHuesped"("nacionalidad");
