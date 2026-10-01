-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('estudiante', 'profesor');

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('presencial', 'remoto');

-- CreateEnum
CREATE TYPE "TipoBloque" AS ENUM ('laboral', 'familiar', 'personal');

-- CreateEnum
CREATE TYPE "RolIntegrante" AS ENUM ('lider', 'miembro', 'observador');

-- CreateEnum
CREATE TYPE "EstadoInvitacion" AS ENUM ('pendiente', 'aceptada', 'rechazada', 'retirado');

-- CreateEnum
CREATE TYPE "EstadoGrupo" AS ENUM ('activo', 'finalizado');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('pendiente', 'en_progreso', 'en_revision', 'completada');

-- CreateEnum
CREATE TYPE "AccionHistorial" AS ENUM ('creada', 'estado', 'reasignada');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('invitacion_grupo', 'invitacion_respondida', 'tarea_asignada', 'tarea_en_revision', 'tarea_devuelta', 'tarea_completada');

-- CreateEnum
CREATE TYPE "EstadoCorreo" AS ENUM ('no_aplica', 'pendiente', 'enviado', 'fallido');

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "google_id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "dominio_correo" TEXT,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT,
    "foto_url" TEXT,
    "eliminado_en" TIMESTAMP(3),
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "perfil" (
    "id_perfil" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo_cuenta" "TipoCuenta" NOT NULL DEFAULT 'estudiante',
    "institucion" TEXT,
    "carrera" TEXT,
    "ciclo" INTEGER,
    "biografia" VARCHAR(300),
    "trabaja" BOOLEAN NOT NULL DEFAULT false,
    "visible_en_busqueda" BOOLEAN NOT NULL DEFAULT true,
    "fecha_actualizacion" TIMESTAMP(3),

    CONSTRAINT "perfil_pkey" PRIMARY KEY ("id_perfil")
);

-- CreateTable
CREATE TABLE "bloque_ocupado" (
    "id_bloque_ocupado" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo" "TipoBloque" NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fin" TIME NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloque_ocupado_pkey" PRIMARY KEY ("id_bloque_ocupado")
);

-- CreateTable
CREATE TABLE "curso" (
    "id_curso" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "modalidad" "Modalidad",
    "codigo" TEXT,
    "docente" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curso_pkey" PRIMARY KEY ("id_curso")
);

-- CreateTable
CREATE TABLE "horario_curso" (
    "id_horario" SERIAL NOT NULL,
    "id_curso" INTEGER NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fin" TIME NOT NULL,

    CONSTRAINT "horario_curso_pkey" PRIMARY KEY ("id_horario")
);

-- CreateTable
CREATE TABLE "evaluacion" (
    "id_evaluacion" SERIAL NOT NULL,
    "id_curso" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_apertura" TIMESTAMP(3),
    "fecha_cierre" TIMESTAMP(3) NOT NULL,
    "requiere_entrega" BOOLEAN NOT NULL DEFAULT true,
    "fecha_entrega" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluacion_pkey" PRIMARY KEY ("id_evaluacion")
);

-- CreateTable
CREATE TABLE "grupo" (
    "id_grupo" SERIAL NOT NULL,
    "id_creador" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "id_evaluacion" INTEGER,
    "fecha_limite" TIMESTAMP(3),
    "enlace_trabajo" TEXT,
    "estado" "EstadoGrupo" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupo_pkey" PRIMARY KEY ("id_grupo")
);

-- CreateTable
CREATE TABLE "grupo_integrante" (
    "id_integrante" SERIAL NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "rol" "RolIntegrante" NOT NULL DEFAULT 'miembro',
    "estado_invitacion" "EstadoInvitacion" NOT NULL DEFAULT 'pendiente',
    "correo_actividad" BOOLEAN NOT NULL DEFAULT true,
    "fecha_invitacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_respuesta" TIMESTAMP(3),

    CONSTRAINT "grupo_integrante_pkey" PRIMARY KEY ("id_integrante")
);

-- CreateTable
CREATE TABLE "tarea" (
    "id_tarea" SERIAL NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "id_creador" INTEGER NOT NULL,
    "id_asignado" INTEGER,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoTarea" NOT NULL DEFAULT 'pendiente',
    "peso" SMALLINT NOT NULL DEFAULT 1,
    "fecha_limite" TIMESTAMP(3),
    "fecha_terminada" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarea_pkey" PRIMARY KEY ("id_tarea")
);

-- CreateTable
CREATE TABLE "tarea_historial" (
    "id_historial" SERIAL NOT NULL,
    "id_tarea" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "accion" "AccionHistorial" NOT NULL,
    "valor_anterior" TEXT,
    "valor_nuevo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarea_historial_pkey" PRIMARY KEY ("id_historial")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id_notificacion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enlace" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "estado_correo" "EstadoCorreo" NOT NULL DEFAULT 'no_aplica',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_google_id_key" ON "usuario"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_id_usuario_key" ON "perfil"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_integrante_id_grupo_id_usuario_key" ON "grupo_integrante"("id_grupo", "id_usuario");

-- CreateIndex
CREATE INDEX "tarea_id_grupo_estado_idx" ON "tarea"("id_grupo", "estado");

-- CreateIndex
CREATE INDEX "notificacion_id_usuario_leida_idx" ON "notificacion"("id_usuario", "leida");

-- AddForeignKey
ALTER TABLE "perfil" ADD CONSTRAINT "perfil_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloque_ocupado" ADD CONSTRAINT "bloque_ocupado_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_curso" ADD CONSTRAINT "horario_curso_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "curso"("id_curso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion" ADD CONSTRAINT "evaluacion_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "curso"("id_curso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_id_creador_fkey" FOREIGN KEY ("id_creador") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_id_evaluacion_fkey" FOREIGN KEY ("id_evaluacion") REFERENCES "evaluacion"("id_evaluacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_integrante" ADD CONSTRAINT "grupo_integrante_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo"("id_grupo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_integrante" ADD CONSTRAINT "grupo_integrante_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo"("id_grupo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_id_creador_fkey" FOREIGN KEY ("id_creador") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_id_asignado_fkey" FOREIGN KEY ("id_asignado") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_historial" ADD CONSTRAINT "tarea_historial_id_tarea_fkey" FOREIGN KEY ("id_tarea") REFERENCES "tarea"("id_tarea") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_historial" ADD CONSTRAINT "tarea_historial_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
