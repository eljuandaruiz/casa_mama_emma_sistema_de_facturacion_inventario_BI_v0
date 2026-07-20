-- AlterTable
ALTER TABLE "TrabajoMantenimiento" ADD COLUMN "responsableTel" TEXT;
ALTER TABLE "TrabajoMantenimiento" ADD COLUMN "supervisorTel" TEXT;

-- CreateTable
CREATE TABLE "Contacto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "oficio" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Contacto_nombre_idx" ON "Contacto"("nombre");
