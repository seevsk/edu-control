import { prisma } from "@/server/db/client";
import { horaATime, finDeDiaLimaAUtc, inicioDeDiaLimaAUtc } from "@/lib/dates";
import type {
  crearCursoSchema,
  actualizarCursoSchema,
  crearHorarioSchema,
  crearEvaluacionSchema,
} from "@/lib/validation/curso";
import type { z } from "zod";

export async function listarEvaluacionesDelUsuario(idUsuario: number) {
  return prisma.evaluacion.findMany({
    where: { curso: { idUsuario } },
    include: { curso: true },
    orderBy: { fechaCierre: "asc" },
  });
}

export async function yaImportoCurso(idUsuario: number, idCursoFuente: number) {
  const existente = await prisma.curso.findFirst({
    where: { idUsuario, importadoDeIdCurso: idCursoFuente },
    select: { idCurso: true },
  });
  return existente !== null;
}

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
  const curso = await prisma.curso.update({
    where: { idCurso },
    data: {
      nombre: datos.nombre,
      codigo: datos.codigo || null,
      docente: datos.docente || null,
      modalidad: datos.modalidad,
      activo: datos.activo,
    },
  });

  // Sincroniza las copias que otros integrantes importaron de este curso (nunca "activo": es de cada quien).
  await prisma.curso.updateMany({
    where: { importadoDeIdCurso: idCurso },
    data: { nombre: curso.nombre, docente: curso.docente, modalidad: curso.modalidad },
  });

  return curso;
}

/**
 * El invitado a un grupo que nace de un curso del anfitrion puede traerse ese curso a los suyos.
 * Nunca aplica al propio dueño del curso. Si ya tiene uno con el mismo codigo, lo sobrescribe
 * (nombre/docente/modalidad) en vez de duplicarlo; si no, crea uno nuevo. Queda enlazado para
 * que futuras ediciones del anfitrion se sincronicen solas.
 */
export async function importarCursoDesdeGrupo(idUsuario: number, idGrupo: number) {
  const integrante = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
  });
  if (!integrante || integrante.estadoInvitacion !== "aceptada") {
    throw new Error("No eres integrante de este grupo");
  }

  const grupo = await prisma.grupo.findUnique({
    where: { idGrupo },
    include: { evaluacion: { include: { curso: true } } },
  });
  const cursoFuente = grupo?.evaluacion?.curso;
  if (!cursoFuente) throw new Error("Este grupo no tiene un curso vinculado");
  if (cursoFuente.idUsuario === idUsuario) throw new Error("Ya es tu curso");

  const existente = cursoFuente.codigo
    ? await prisma.curso.findFirst({
        where: { idUsuario, codigo: { equals: cursoFuente.codigo, mode: "insensitive" } },
      })
    : null;

  const datosSincronizados = {
    nombre: cursoFuente.nombre,
    docente: cursoFuente.docente,
    modalidad: cursoFuente.modalidad,
    importadoDeIdCurso: cursoFuente.idCurso,
  };

  const cursoLocal = existente
    ? await prisma.curso.update({ where: { idCurso: existente.idCurso }, data: datosSincronizados })
    : await prisma.curso.create({ data: { idUsuario, codigo: cursoFuente.codigo, ...datosSincronizados } });

  await sincronizarListasDeCurso(cursoFuente.idCurso, cursoLocal.idCurso);

  return cursoLocal;
}

/**
 * Trae del curso original lo que falte en horario_curso/evaluacion (por el id importado, nunca
 * por nombre) y actualiza lo que ya existe. Nunca borra nada ni toca fecha_entrega: es personal.
 */
async function sincronizarListasDeCurso(idCursoFuente: number, idCursoLocal: number) {
  const [horariosFuente, evaluacionesFuente, horariosLocales, evaluacionesLocales] = await Promise.all([
    prisma.horarioCurso.findMany({ where: { idCurso: idCursoFuente } }),
    prisma.evaluacion.findMany({ where: { idCurso: idCursoFuente } }),
    prisma.horarioCurso.findMany({ where: { idCurso: idCursoLocal } }),
    prisma.evaluacion.findMany({ where: { idCurso: idCursoLocal } }),
  ]);

  for (const horario of horariosFuente) {
    const local = horariosLocales.find((h) => h.importadoDeIdHorario === horario.idHorario);
    if (local) {
      if (
        local.diaSemana !== horario.diaSemana ||
        local.horaInicio.getTime() !== horario.horaInicio.getTime() ||
        local.horaFin.getTime() !== horario.horaFin.getTime()
      ) {
        await prisma.horarioCurso.update({
          where: { idHorario: local.idHorario },
          data: { diaSemana: horario.diaSemana, horaInicio: horario.horaInicio, horaFin: horario.horaFin },
        });
      }
    } else {
      await prisma.horarioCurso.create({
        data: {
          idCurso: idCursoLocal,
          diaSemana: horario.diaSemana,
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
          importadoDeIdHorario: horario.idHorario,
        },
      });
    }
  }

  for (const evaluacion of evaluacionesFuente) {
    const local = evaluacionesLocales.find((e) => e.importadoDeIdEvaluacion === evaluacion.idEvaluacion);
    if (local) {
      if (
        local.nombre !== evaluacion.nombre ||
        local.fechaCierre.getTime() !== evaluacion.fechaCierre.getTime() ||
        (local.fechaApertura?.getTime() ?? null) !== (evaluacion.fechaApertura?.getTime() ?? null) ||
        local.requiereEntrega !== evaluacion.requiereEntrega
      ) {
        await prisma.evaluacion.update({
          where: { idEvaluacion: local.idEvaluacion },
          data: {
            nombre: evaluacion.nombre,
            fechaCierre: evaluacion.fechaCierre,
            fechaApertura: evaluacion.fechaApertura,
            requiereEntrega: evaluacion.requiereEntrega,
          },
        });
      }
    } else {
      await prisma.evaluacion.create({
        data: {
          idCurso: idCursoLocal,
          nombre: evaluacion.nombre,
          fechaCierre: evaluacion.fechaCierre,
          fechaApertura: evaluacion.fechaApertura,
          requiereEntrega: evaluacion.requiereEntrega,
          importadoDeIdEvaluacion: evaluacion.idEvaluacion,
        },
      });
    }
  }
}

/** Para mostrar el aviso de "hay actualizaciones" sin traerlas todavia. */
export async function hayActualizacionesDeCursoImportado(idCursoLocal: number) {
  const local = await prisma.curso.findUnique({
    where: { idCurso: idCursoLocal },
    include: { horarios: true, evaluaciones: true },
  });
  if (!local?.importadoDeIdCurso) return false;

  const fuente = await prisma.curso.findUnique({
    where: { idCurso: local.importadoDeIdCurso },
    include: { horarios: true, evaluaciones: true },
  });
  if (!fuente) return false;

  const horarioPendiente = fuente.horarios.some((h) => {
    const l = local.horarios.find((x) => x.importadoDeIdHorario === h.idHorario);
    if (!l) return true;
    return (
      l.diaSemana !== h.diaSemana ||
      l.horaInicio.getTime() !== h.horaInicio.getTime() ||
      l.horaFin.getTime() !== h.horaFin.getTime()
    );
  });

  const evaluacionPendiente = fuente.evaluaciones.some((e) => {
    const l = local.evaluaciones.find((x) => x.importadoDeIdEvaluacion === e.idEvaluacion);
    if (!l) return true;
    return (
      l.nombre !== e.nombre ||
      l.fechaCierre.getTime() !== e.fechaCierre.getTime() ||
      (l.fechaApertura?.getTime() ?? null) !== (e.fechaApertura?.getTime() ?? null) ||
      l.requiereEntrega !== e.requiereEntrega
    );
  });

  return horarioPendiente || evaluacionPendiente;
}

/** Boton "traer actualizaciones" del invitado: trae lo nuevo/cambiado de horario y evaluaciones. */
export async function sincronizarCursoImportado(idUsuario: number, idCursoLocal: number) {
  const local = await obtenerCursoDelUsuario(idUsuario, idCursoLocal);
  if (!local.importadoDeIdCurso) throw new Error("Este curso no esta importado de otro");
  await sincronizarListasDeCurso(local.importadoDeIdCurso, idCursoLocal);
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
