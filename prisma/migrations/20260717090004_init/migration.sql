-- CreateTable
CREATE TABLE "Habitacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcionCamas" TEXT NOT NULL,
    "camasMatrimonial" INTEGER NOT NULL DEFAULT 0,
    "camasSimple" INTEGER NOT NULL DEFAULT 0,
    "camasLitera" INTEGER NOT NULL DEFAULT 0,
    "capacidad" INTEGER NOT NULL,
    "precioHabitacion" REAL NOT NULL,
    "precioPersona" REAL NOT NULL,
    "grupoCompartido" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipoIdentificacion" TEXT NOT NULL,
    "identificacion" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "direccion" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establecimiento" TEXT NOT NULL,
    "puntoEmision" TEXT NOT NULL,
    "secuencial" INTEGER NOT NULL,
    "numeroCompleto" TEXT NOT NULL,
    "fechaEmision" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ambiente" TEXT NOT NULL,
    "claveAcceso" TEXT NOT NULL,
    "estadoSri" TEXT NOT NULL DEFAULT 'GENERADA',
    "numeroAutorizacion" TEXT,
    "fechaAutorizacion" DATETIME,
    "mensajesSri" TEXT,
    "xmlFirmado" TEXT,
    "clienteId" INTEGER NOT NULL,
    "modoPrecio" TEXT NOT NULL,
    "huespedes" INTEGER NOT NULL DEFAULT 1,
    "noches" INTEGER NOT NULL DEFAULT 1,
    "checkIn" DATETIME,
    "checkOut" DATETIME,
    "subtotalSinImpuestos" REAL NOT NULL,
    "totalDescuento" REAL NOT NULL DEFAULT 0,
    "base15" REAL NOT NULL DEFAULT 0,
    "base8" REAL NOT NULL DEFAULT 0,
    "base0" REAL NOT NULL DEFAULT 0,
    "valorIva" REAL NOT NULL DEFAULT 0,
    "propina" REAL NOT NULL DEFAULT 0,
    "importeTotal" REAL NOT NULL,
    "formaPago" TEXT NOT NULL,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Factura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DetalleFactura" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "facturaId" TEXT NOT NULL,
    "habitacionId" INTEGER,
    "codigoPrincipal" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "precioUnitario" REAL NOT NULL,
    "descuento" REAL NOT NULL DEFAULT 0,
    "precioTotalSinImpuesto" REAL NOT NULL,
    "codigoPorcentajeIva" TEXT NOT NULL,
    "tarifaIva" REAL NOT NULL,
    "valorIva" REAL NOT NULL,
    CONSTRAINT "DetalleFactura_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DetalleFactura_habitacionId_fkey" FOREIGN KEY ("habitacionId") REFERENCES "Habitacion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "proveedor" TEXT,
    "rucProveedor" TEXT,
    "numeroComprobante" TEXT,
    "subtotal" REAL NOT NULL,
    "iva" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "formaPago" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "deducible" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Secuencial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "establecimiento" TEXT NOT NULL,
    "puntoEmision" TEXT NOT NULL,
    "tipoComprobante" TEXT NOT NULL DEFAULT '01',
    "ultimo" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "dirMatriz" TEXT NOT NULL,
    "dirEstablecimiento" TEXT NOT NULL,
    "obligadoContabilidad" TEXT NOT NULL DEFAULT 'NO',
    "telefono" TEXT,
    "emailEmisor" TEXT,
    "leyendaRide" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Habitacion_numero_key" ON "Habitacion"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_identificacion_key" ON "Cliente"("identificacion");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_numeroCompleto_key" ON "Factura"("numeroCompleto");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_claveAcceso_key" ON "Factura"("claveAcceso");

-- CreateIndex
CREATE INDEX "Factura_fechaEmision_idx" ON "Factura"("fechaEmision");

-- CreateIndex
CREATE INDEX "Factura_estadoSri_idx" ON "Factura"("estadoSri");

-- CreateIndex
CREATE INDEX "Gasto_fecha_idx" ON "Gasto"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Secuencial_establecimiento_puntoEmision_tipoComprobante_key" ON "Secuencial"("establecimiento", "puntoEmision", "tipoComprobante");
