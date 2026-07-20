-- CreateTable
CREATE TABLE "Tarea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha" DATETIME NOT NULL,
    "duracionMin" INTEGER NOT NULL DEFAULT 60,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "origen" TEXT NOT NULL DEFAULT 'MANUAL',
    "referenciaId" TEXT,
    "eventoGoogleId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Tarea_fecha_idx" ON "Tarea"("fecha");
CREATE INDEX "Tarea_completada_idx" ON "Tarea"("completada");
