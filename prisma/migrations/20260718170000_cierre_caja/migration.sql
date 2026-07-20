-- CreateTable
CREATE TABLE "CierreCaja" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desde" DATETIME NOT NULL,
    "hasta" DATETIME NOT NULL,
    "usuario" TEXT NOT NULL,
    "saldoInicial" REAL NOT NULL DEFAULT 0,
    "ingresosEfectivo" REAL NOT NULL DEFAULT 0,
    "egresosEfectivo" REAL NOT NULL DEFAULT 0,
    "efectivoEsperado" REAL NOT NULL DEFAULT 0,
    "efectivoContado" REAL NOT NULL,
    "diferencia" REAL NOT NULL DEFAULT 0,
    "nFacturas" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CierreCaja_fecha_idx" ON "CierreCaja"("fecha");
