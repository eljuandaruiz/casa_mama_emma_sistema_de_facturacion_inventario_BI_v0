-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrabajoMantenimiento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "descripcionGeneral" TEXT,
    "area" TEXT,
    "categoria" TEXT NOT NULL DEFAULT 'GENERAL',
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
INSERT INTO "new_TrabajoMantenimiento" ("area", "costoTotal", "creadoEn", "descripcionGeneral", "fecha", "fechaFin", "fechaInicio", "id", "inventarioConsumido", "itemsCosto", "materialSobrante", "numerosFactura", "responsable", "responsableTel", "supervisor", "supervisorTel", "tiempoInvertido", "tipo", "titulo", "totalDias", "totalHoras") SELECT "area", "costoTotal", "creadoEn", "descripcionGeneral", "fecha", "fechaFin", "fechaInicio", "id", "inventarioConsumido", "itemsCosto", "materialSobrante", "numerosFactura", "responsable", "responsableTel", "supervisor", "supervisorTel", "tiempoInvertido", "tipo", "titulo", "totalDias", "totalHoras" FROM "TrabajoMantenimiento";
DROP TABLE "TrabajoMantenimiento";
ALTER TABLE "new_TrabajoMantenimiento" RENAME TO "TrabajoMantenimiento";
CREATE INDEX "TrabajoMantenimiento_fecha_idx" ON "TrabajoMantenimiento"("fecha");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
