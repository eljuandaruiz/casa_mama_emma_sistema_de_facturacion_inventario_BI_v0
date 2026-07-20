-- CreateTable
CREATE TABLE "SolicitudHuesped" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "tipoIdentificacion" TEXT NOT NULL,
    "identificacion" TEXT NOT NULL,
    "direccion" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "numeroHabitacion" INTEGER,
    "mensaje" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "facturaId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SolicitudHuesped_estado_idx" ON "SolicitudHuesped"("estado");

-- CreateIndex
CREATE INDEX "SolicitudHuesped_creadoEn_idx" ON "SolicitudHuesped"("creadoEn");
