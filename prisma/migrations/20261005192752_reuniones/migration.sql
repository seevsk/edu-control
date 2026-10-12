-- CreateEnum
CREATE TYPE "RespuestaReunion" AS ENUM ('pendiente', 'asistire', 'no_asistire');

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'reunion_programada';

-- CreateTable
CREATE TABLE "reunion" (
    "id_reunion" SERIAL NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "id_creador" INTEGER NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "lugar" VARCHAR(160),
    "enlace" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reunion_pkey" PRIMARY KEY ("id_reunion")
);

-- CreateTable
CREATE TABLE "reunion_asistente" (
    "id_reunion" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "respuesta" "RespuestaReunion" NOT NULL DEFAULT 'pendiente',
    "fecha_respuesta" TIMESTAMP(3),

    CONSTRAINT "reunion_asistente_pkey" PRIMARY KEY ("id_reunion","id_usuario")
);

-- CreateIndex
CREATE INDEX "reunion_id_grupo_inicio_idx" ON "reunion"("id_grupo", "inicio");

-- AddForeignKey
ALTER TABLE "reunion" ADD CONSTRAINT "reunion_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo"("id_grupo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reunion" ADD CONSTRAINT "reunion_id_creador_fkey" FOREIGN KEY ("id_creador") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reunion_asistente" ADD CONSTRAINT "reunion_asistente_id_reunion_fkey" FOREIGN KEY ("id_reunion") REFERENCES "reunion"("id_reunion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reunion_asistente" ADD CONSTRAINT "reunion_asistente_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
