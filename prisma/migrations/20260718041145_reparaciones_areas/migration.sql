-- AlterTable
ALTER TABLE "TrabajoMantenimiento" ADD COLUMN "area" TEXT;

-- CreateTable
CREATE TABLE "SolicitudReparacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "area" TEXT,
    "imagen" TEXT,
    "detectadoPor" TEXT,
    "prioridad" TEXT NOT NULL DEFAULT 'IMPORTANTE_NO_URGENTE',
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "fechaLimite" DATETIME,
    "eventoGoogleId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SolicitudReparacion_estado_idx" ON "SolicitudReparacion"("estado");

-- CreateIndex
CREATE INDEX "SolicitudReparacion_prioridad_idx" ON "SolicitudReparacion"("prioridad");
