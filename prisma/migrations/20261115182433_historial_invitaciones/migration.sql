-- AlterTable
ALTER TABLE "grupo_integrante" ADD COLUMN     "fecha_retiro" TIMESTAMP(3),
ADD COLUMN     "id_invitador" INTEGER;

-- AddForeignKey
ALTER TABLE "grupo_integrante" ADD CONSTRAINT "grupo_integrante_id_invitador_fkey" FOREIGN KEY ("id_invitador") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- Registros anteriores: no se guardaba quién invitó; se asume el creador del grupo (no aplica a su propia fila).
UPDATE "grupo_integrante" AS gi
SET "id_invitador" = g."id_creador"
FROM "grupo" AS g
WHERE gi."id_grupo" = g."id_grupo"
  AND gi."id_usuario" <> g."id_creador";
