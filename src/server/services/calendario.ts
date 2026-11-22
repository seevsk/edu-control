import { prisma } from "@/server/db/client";
import { diasDeLaSemana, sumarDiasISO } from "@/lib/calendario";
import { reunionesDelUsuarioEntre } from "@/server/services/reunion";

/** Datos del calendario entre dos fechas de Lima; `hastaISO` es exclusivo. */
export async function obtenerCalendarioEntre(idUsuario: number, desdeISO: string, hastaISO: string) {
  const desde = new Date(`${desdeISO}T00:00:00-05:00`);
  const hasta = new Date(`${hastaISO}T00:00:00-05:00`);
  const [cursos, bloquesOcupados, evaluaciones, tareas, reuniones] = await Promise.all([
    prisma.curso.findMany({
      where: { idUsuario, activo: true },
      include: {
        horarios: true,
        evaluaciones: {
          where: { fechaCierre: { gte: new Date() }, estado: { in: ["pendiente", "en_progreso"] } },
          orderBy: { fechaCierre: "asc" },
          take: 1,
          select: { nombre: true, fechaCierre: true },
        },
      },
    }),
    prisma.bloqueOcupado.findMany({
      where: { idUsuario },
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.evaluacion.findMany({
      // Las evaluaciones de cursos inactivos se ocultan (como sus clases); siguen en el detalle del curso.
      where: { curso: { idUsuario, activo: true }, estado: { not: "descartada" }, fechaCierre: { gte: desde, lt: hasta } },
      include: { curso: true },
      orderBy: { fechaCierre: "asc" },
    }),
    prisma.tarea.findMany({
      where: { idAsignado: idUsuario, estado: { not: "descartada" }, fechaLimite: { gte: desde, lt: hasta } },
      include: { grupo: true },
      orderBy: { fechaLimite: "asc" },
    }),
    reunionesDelUsuarioEntre(idUsuario, desde, hasta),
  ]);

  const horarios = cursos.flatMap((curso) =>
    curso.horarios.map((horario) => ({
      ...horario,
      curso: {
        idCurso: curso.idCurso,
        nombre: curso.nombre,
        modalidad: curso.modalidad,
        docente: curso.docente,
        proximaEvaluacion: curso.evaluaciones[0] ?? null,
      },
    })),
  );

  return { horarios, bloquesOcupados, evaluaciones, tareas, reuniones };
}

export async function obtenerSemanaCalendario(idUsuario: number, lunesISO: string) {
  const dias = diasDeLaSemana(lunesISO);
  const datos = await obtenerCalendarioEntre(idUsuario, lunesISO, sumarDiasISO(lunesISO, 7));
  return { dias, ...datos };
}
