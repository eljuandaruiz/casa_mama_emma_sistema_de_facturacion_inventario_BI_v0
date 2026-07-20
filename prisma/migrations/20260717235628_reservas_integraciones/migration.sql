-- CreateTable
CREATE TABLE "Reserva" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fuente" TEXT NOT NULL DEFAULT 'AIRBNB',
    "uid" TEXT NOT NULL,
    "resumen" TEXT,
    "huespedNombre" TEXT,
    "numHuespedes" INTEGER,
    "nacionalidad" TEXT,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "numeroHabitacion" INTEGER,
    "facturaId" TEXT,
    "eventoGoogleId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Integraciones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "airbnbIcalUrl" TEXT,
    "googleRefreshToken" TEXT,
    "googleCalendarId" TEXT NOT NULL DEFAULT 'primary',
    "googleConectadoEmail" TEXT,
    "ultimaSyncAirbnb" DATETIME,
    "ultimaSyncGoogle" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_uid_key" ON "Reserva"("uid");

-- CreateIndex
CREATE INDEX "Reserva_checkIn_idx" ON "Reserva"("checkIn");

-- CreateIndex
CREATE INDEX "Reserva_fuente_idx" ON "Reserva"("fuente");
