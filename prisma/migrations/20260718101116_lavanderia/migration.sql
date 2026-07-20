-- CreateTable
CREATE TABLE "CicloLavado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipoLencerria" TEXT NOT NULL DEFAULT 'MIXTO',
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "costoJabon" REAL NOT NULL DEFAULT 0,
    "costoAguaLuz" REAL NOT NULL DEFAULT 0,
    "costoTotal" REAL NOT NULL DEFAULT 0,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CicloLavado_fecha_idx" ON "CicloLavado"("fecha");
