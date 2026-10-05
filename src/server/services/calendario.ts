import { prisma } from "@/server/db/client";
import { diasDeLaSemana, sumarDiasISO } from "@/lib/calendario";

export async function obtenerSemanaCalendario(idUsuario: number, lunesISO: string) {
  const dias = diasDeLaSemana(lunesISO);
  const desde = new Date(`${lunesISO}T00:00:00-05:00`);
  const hasta = new Date(`${sumarDiasISO(lunesISO, 7)}T00:00:00-05:00`);

  const [cursos, bloquesOcupados, evaluaciones, tareas] = await Promise.all([
    prisma.curso.findMany({
      where: { idUsuario, activo: true },
      include: { horarios: true },
    }),
    prisma.bloqueOcupado.findMany({
      where: { idUsuario },
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.evaluacion.findMany({
      where: { curso: { idUsuario }, fechaCierre: { gte: desde, lt: hasta } },
      include: { curso: true },
      orderBy: { fechaCierre: "asc" },
    }),
    prisma.tarea.findMany({
      where: { idAsignado: idUsuario, fechaLimite: { gte: desde, lt: hasta } },
      include: { grupo: true },
      orderBy: { fechaLimite: "asc" },
    }),
  ]);

  const horarios = cursos.flatMap((curso) =>
    curso.horarios.map((horario) => ({
      ...horario,
      curso: { idCurso: curso.idCurso, nombre: curso.nombre, modalidad: curso.modalidad },
    })),
  );

  return { dias, horarios, bloquesOcupados, evaluaciones, tareas };
}
