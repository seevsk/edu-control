-- AlterTable
ALTER TABLE "curso" ADD COLUMN     "importado_de_id_curso" INTEGER;

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_importado_de_id_curso_fkey" FOREIGN KEY ("importado_de_id_curso") REFERENCES "curso"("id_curso") ON DELETE SET NULL ON UPDATE CASCADE;
