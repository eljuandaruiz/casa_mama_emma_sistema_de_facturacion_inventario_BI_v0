-- Configuracion: código de referencia de la factura editable
ALTER TABLE "Configuracion" ADD COLUMN "establecimiento" TEXT;
ALTER TABLE "Configuracion" ADD COLUMN "puntoEmision" TEXT;
