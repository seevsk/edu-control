import { prisma } from "@/server/db/client";
import { horaATime, finDeDiaLimaAUtc, inicioDeDiaLimaAUtc } from "@/lib/dates";
import type {
  crearCursoSchema,
  actualizarCursoSchema,
  crearHorarioSchema,
  crearEvaluacionSchema,
} from "@/lib/validation/curso";
import type { z } from "zod";

export async function listarCursos(idUsuario: number) {
  return prisma.curso.findMany({
    where: { idUsuario },
    include: { horarios: true, evaluaciones: { orderBy: { fechaCierre: "asc" } } },
    orderBy: { fechaCreacion: "desc" },
  });
}

/** Lanza si el curso no existe o no es del usuario: nunca se confia en un id que venga del cliente. */
export async function obtenerCursoDelUsuario(idUsuario: number, idCurso: number) {
  const curso = await prisma.curso.findFirst({
    where: { idCurso, idUsuario },
    include: { horarios: true, evaluaciones: { orderBy: { fechaCierre: "asc" } } },
  });
  if (!curso) throw new Error("Curso no encontrado");
  return curso;
}

export async function crearCurso(idUsuario: number, datos: z.infer<typeof crearCursoSchema>) {
  return prisma.curso.create({
    data: {
      idUsuario,
      nombre: datos.nombre,
      codigo: datos.codigo || null,
      docente: datos.docente || null,
      modalidad: datos.modalidad,
    },
  });
}

export async function actualizarCurso(
  idUsuario: number,
  idCurso: number,
  datos: z.infer<typeof actualizarCursoSchema>,
) {
  await obtenerCursoDelUsuario(idUsuario, idCurso);
  return prisma.curso.update({
    where: { idCurso },
    data: {
      nombre: datos.nombre,
      codigo: datos.codigo || null,
      docente: datos.docente || null,
      modalidad: datos.modalidad,
      activo: datos.activo,
    },
  });
}

export async function agregarHorario(
  idUsuario: number,
  idCurso: number,
  datos: z.infer<typeof crearHorarioSchema>,
) {
  await obtenerCursoDelUsuario(idUsuario, idCurso);
  return prisma.horarioCurso.create({
    data: {
      idCurso,
      diaSemana: datos.diaSemana,
      horaInicio: horaATime(datos.horaInicio),
      horaFin: horaATime(datos.horaFin),
    },
  });
}

export async function eliminarHorario(idUsuario: number, idCurso: number, idHorario: number) {
  await obtenerCursoDelUsuario(idUsuario, idCurso);
  await prisma.horarioCurso.deleteMany({ where: { idHorario, idCurso } });
}

export async function agregarEvaluacion(
  idUsuario: number,
  idCurso: number,
  datos: z.infer<typeof crearEvaluacionSchema>,
) {
  await obtenerCursoDelUsuario(idUsuario, idCurso);
  return prisma.evaluacion.create({
    data: {
      idCurso,
      nombre: datos.nombre,
      fechaApertura: datos.fechaApertura ? inicioDeDiaLimaAUtc(datos.fechaApertura) : null,
      fechaCierre: finDeDiaLimaAUtc(datos.fechaCierre),
      requiereEntrega: datos.requiereEntrega,
    },
  });
}

export async function eliminarEvaluacion(idUsuario: number, idCurso: number, idEvaluacion: number) {
  await obtenerCursoDelUsuario(idUsuario, idCurso);
  await prisma.evaluacion.deleteMany({ where: { idEvaluacion, idCurso } });
}

export async function marcarEvaluacionEntregada(
  idUsuario: number,
  idCurso: number,
  idEvaluacion: number,
) {
  await obtenerCursoDelUsuario(idUsuario, idCurso);
  await prisma.evaluacion.updateMany({
    where: { idEvaluacion, idCurso },
    data: { fechaEntrega: new Date() },
  });
}
