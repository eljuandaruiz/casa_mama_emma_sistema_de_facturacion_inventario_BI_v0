-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FotoMantenimiento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trabajoId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "fase" TEXT NOT NULL DEFAULT 'ANTES',
    "imagen" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "FotoMantenimiento_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "TrabajoMantenimiento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FotoMantenimiento" ("descripcion", "id", "imagen", "orden", "trabajoId") SELECT "descripcion", "id", "imagen", "orden", "trabajoId" FROM "FotoMantenimiento";
DROP TABLE "FotoMantenimiento";
ALTER TABLE "new_FotoMantenimiento" RENAME TO "FotoMantenimiento";
CREATE TABLE "new_TrabajoMantenimiento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "descripcionGeneral" TEXT,
    "area" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tiempoInvertido" TEXT,
    "responsable" TEXT,
    "responsableTel" TEXT,
    "supervisor" TEXT,
    "supervisorTel" TEXT,
    "numerosFactura" TEXT,
    "inventarioConsumido" TEXT,
    "materialSobrante" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'MEJORA',
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "totalDias" INTEGER,
    "totalHoras" REAL,
    "itemsCosto" TEXT NOT NULL DEFAULT '[]',
    "costoTotal" REAL NOT NULL DEFAULT 0,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_TrabajoMantenimiento" ("area", "costoTotal", "creadoEn", "descripcionGeneral", "fecha", "id", "inventarioConsumido", "itemsCosto", "materialSobrante", "numerosFactura", "responsable", "responsableTel", "supervisor", "supervisorTel", "tiempoInvertido", "titulo") SELECT "area", "costoTotal", "creadoEn", "descripcionGeneral", "fecha", "id", "inventarioConsumido", "itemsCosto", "materialSobrante", "numerosFactura", "responsable", "responsableTel", "supervisor", "supervisorTel", "tiempoInvertido", "titulo" FROM "TrabajoMantenimiento";
DROP TABLE "TrabajoMantenimiento";
ALTER TABLE "new_TrabajoMantenimiento" RENAME TO "TrabajoMantenimiento";
CREATE INDEX "TrabajoMantenimiento_fecha_idx" ON "TrabajoMantenimiento"("fecha");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
