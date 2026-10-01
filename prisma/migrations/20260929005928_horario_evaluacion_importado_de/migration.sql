-- AlterTable
ALTER TABLE "evaluacion" ADD COLUMN     "importado_de_id_evaluacion" INTEGER;

-- AlterTable
ALTER TABLE "horario_curso" ADD COLUMN     "importado_de_id_horario" INTEGER;

-- AddForeignKey
ALTER TABLE "horario_curso" ADD CONSTRAINT "horario_curso_importado_de_id_horario_fkey" FOREIGN KEY ("importado_de_id_horario") REFERENCES "horario_curso"("id_horario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion" ADD CONSTRAINT "evaluacion_importado_de_id_evaluacion_fkey" FOREIGN KEY ("importado_de_id_evaluacion") REFERENCES "evaluacion"("id_evaluacion") ON DELETE SET NULL ON UPDATE CASCADE;
