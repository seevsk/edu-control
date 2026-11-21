-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'reunion_iniciada';
ALTER TYPE "TipoNotificacion" ADD VALUE 'reunion_finalizada';

-- AlterTable
ALTER TABLE "reunion" ADD COLUMN     "finalizada_en" TIMESTAMP(3),
ADD COLUMN     "id_finalizador" INTEGER,
ADD COLUMN     "iniciada_en" TIMESTAMP(3),
ADD COLUMN     "sala_url" TEXT,
ADD COLUMN     "videollamada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reunion_asistente" ADD COLUMN     "fecha_entrada" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "reunion" ADD CONSTRAINT "reunion_id_finalizador_fkey" FOREIGN KEY ("id_finalizador") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
