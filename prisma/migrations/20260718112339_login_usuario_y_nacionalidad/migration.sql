-- Login por nombre de usuario (se conserva el email) + nacionalidad del cliente (CRM)
ALTER TABLE "Usuario" ADD COLUMN "usuario" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "nacionalidad" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_usuario_key" ON "Usuario"("usuario");
