-- CreateEnum
CREATE TYPE "EstadoEvaluacion" AS ENUM ('pendiente', 'en_progreso', 'completada', 'descartada');

-- CreateEnum
CREATE TYPE "AccionEvaluacion" AS ENUM ('creada', 'vista', 'estado', 'entrega');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'integrante_salio';
ALTER TYPE "TipoNotificacion" ADD VALUE 'evaluacion_creada';

-- AlterTable
ALTER TABLE "evaluacion" ADD COLUMN     "estado" "EstadoEvaluacion" NOT NULL DEFAULT 'pendiente',
ADD COLUMN     "fecha_vista" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "grupo_integrante" ADD COLUMN     "retiro_voluntario" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "evaluacion_historial" (
    "id_historial" SERIAL NOT NULL,
    "id_evaluacion" INTEGER NOT NULL,
    "accion" "AccionEvaluacion" NOT NULL,
    "valor_anterior" TEXT,
    "valor_nuevo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluacion_historial_pkey" PRIMARY KEY ("id_historial")
);

-- CreateIndex
CREATE INDEX "evaluacion_historial_id_evaluacion_idx" ON "evaluacion_historial"("id_evaluacion");

-- AddForeignKey
ALTER TABLE "evaluacion_historial" ADD CONSTRAINT "evaluacion_historial_id_evaluacion_fkey" FOREIGN KEY ("id_evaluacion") REFERENCES "evaluacion"("id_evaluacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- Evaluaciones ya entregadas: se consideran terminadas, y toda evaluacion existente arranca su historial.
UPDATE "evaluacion" SET "estado" = 'completada' WHERE "fecha_entrega" IS NOT NULL;
INSERT INTO "evaluacion_historial" ("id_evaluacion", "accion", "fecha")
SELECT "id_evaluacion", 'creada', "fecha_creacion" FROM "evaluacion";
INSERT INTO "evaluacion_historial" ("id_evaluacion", "accion", "valor_nuevo", "fecha")
SELECT "id_evaluacion", 'entrega', 'entregada', "fecha_entrega" FROM "evaluacion" WHERE "fecha_entrega" IS NOT NULL;
