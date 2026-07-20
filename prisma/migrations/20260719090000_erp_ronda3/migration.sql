-- Factura: nota EN + comprobante de transferencia
ALTER TABLE "Factura" ADD COLUMN "notaAdicionalEn" TEXT;
ALTER TABLE "Factura" ADD COLUMN "pagoComprobante" TEXT;

-- ConsumibleHabitacion: regla de escalado por huéspedes
ALTER TABLE "ConsumibleHabitacion" ADD COLUMN "regla" TEXT NOT NULL DEFAULT 'FIJO';

-- CreateTable
CREATE TABLE "CategoriaGasto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "valor" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "icono" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "CategoriaGasto_valor_key" ON "CategoriaGasto"("valor");

-- CreateTable
CREATE TABLE "TarifaPreset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "gananciaPorPersona" REAL NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "IngresoSimple" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numeroHabitacion" INTEGER,
    "huespedes" INTEGER NOT NULL DEFAULT 1,
    "noches" INTEGER NOT NULL DEFAULT 1,
    "monto" REAL NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'DIRECTO',
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "IngresoSimple_fecha_idx" ON "IngresoSimple"("fecha");
CREATE INDEX "IngresoSimple_numeroHabitacion_idx" ON "IngresoSimple"("numeroHabitacion");

-- CreateTable
CREATE TABLE "ServicioBasicoMes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mes" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" REAL NOT NULL
);
CREATE UNIQUE INDEX "ServicioBasicoMes_mes_tipo_key" ON "ServicioBasicoMes"("mes", "tipo");
CREATE INDEX "ServicioBasicoMes_mes_idx" ON "ServicioBasicoMes"("mes");
