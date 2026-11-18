-- CreateEnum
CREATE TYPE "ResultadoEntrega" AS ENUM ('en_revision', 'aprobada', 'devuelta');

-- CreateTable
CREATE TABLE "entrega" (
    "id_entrega" SERIAL NOT NULL,
    "id_tarea" INTEGER NOT NULL,
    "id_autor" INTEGER NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(2000),
    "enlace" TEXT,
    "resultado" "ResultadoEntrega" NOT NULL DEFAULT 'en_revision',
    "id_revisor" INTEGER,
    "fecha_revision" TIMESTAMP(3),
    "motivo_devolucion" VARCHAR(500),
    "fecha_envio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entrega_pkey" PRIMARY KEY ("id_entrega")
);

-- CreateTable
CREATE TABLE "entrega_archivo" (
    "id_archivo" SERIAL NOT NULL,
    "id_entrega" INTEGER NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "mime" VARCHAR(100) NOT NULL,
    "tamano" INTEGER NOT NULL,

    CONSTRAINT "entrega_archivo_pkey" PRIMARY KEY ("id_archivo")
);

-- CreateTable
CREATE TABLE "entrega_archivo_contenido" (
    "id_archivo" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,

    CONSTRAINT "entrega_archivo_contenido_pkey" PRIMARY KEY ("id_archivo")
);

-- CreateIndex
CREATE INDEX "entrega_id_tarea_fecha_envio_idx" ON "entrega"("id_tarea", "fecha_envio");

-- CreateIndex
CREATE INDEX "entrega_archivo_id_entrega_idx" ON "entrega_archivo"("id_entrega");

-- AddForeignKey
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_id_tarea_fkey" FOREIGN KEY ("id_tarea") REFERENCES "tarea"("id_tarea") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_id_autor_fkey" FOREIGN KEY ("id_autor") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_id_revisor_fkey" FOREIGN KEY ("id_revisor") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega_archivo" ADD CONSTRAINT "entrega_archivo_id_entrega_fkey" FOREIGN KEY ("id_entrega") REFERENCES "entrega"("id_entrega") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega_archivo_contenido" ADD CONSTRAINT "entrega_archivo_contenido_id_archivo_fkey" FOREIGN KEY ("id_archivo") REFERENCES "entrega_archivo"("id_archivo") ON DELETE CASCADE ON UPDATE CASCADE;
