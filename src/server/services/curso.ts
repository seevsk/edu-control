import { prisma } from "@/server/db/client";
import { horaATime, finDeDiaLimaAUtc, inicioDeDiaLimaAUtc } from "@/lib/dates";
import { ErrorDeNegocio } from "@/lib/errores";
import { fechaCompleta } from "@/lib/formato-fecha";
import { transicionEvaluacionValida, valorConMotivo, type EstadoEvaluacion } from "@/lib/estado-evaluacion";
import { ejecutarCambioDeGrupo } from "@/server/services/cambio-grupo";
import { crearNotificacion } from "@/server/notifications/crear-notificacion";
import { plantillasNotificacion } from "@/server/notifications/templates";
import type { Curso, Prisma } from "../../../generated/prisma/client";
import type {
  crearCursoSchema,
  actualizarCursoSchema,
  crearHorarioSchema,
  actualizarHorarioCursoSchema,
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

/** Evaluaciones que un grupo nuevo puede tomar como origen: las que todavía no cierran. */
export async function listarEvaluacionesParaGrupo(idUsuario: number) {
  return prisma.evaluacion.findMany({
    where: { curso: { idUsuario }, fechaCierre: { gte: new Date() } },
    include: { curso: true },
    orderBy: { fechaCierre: "asc" },
  });
}

/** Para el "Inicio": evaluaciones propias que todavia no cierran, sin depender de ningun grupo. */
export async function listarEvaluacionesProximas(idUsuario: number, limite = 8) {
  return prisma.evaluacion.findMany({
    where: { curso: { idUsuario, activo: true }, fechaCierre: { gte: new Date() }, estado: { in: ["pendiente", "en_progreso"] } },
    include: { curso: true },
    orderBy: { fechaCierre: "asc" },
    take: limite,
  });
}

export async function yaImportoCurso(idUsuario: number, idCursoFuente: number) {
  const existente = await prisma.curso.findFirst({
    where: { idUsuario, importadoDeIdCurso: idCursoFuente },
    select: { idCurso: true },
  });
  return existente !== null;
}

export async function listarCursos(idUsuario: number, activo: boolean = true) {
  return prisma.curso.findMany({
    where: { idUsuario, activo },
    include: { horarios: true, evaluaciones: { orderBy: { fechaCierre: "asc" } } },
    orderBy: { fechaCreacion: "desc" },
  });
}

/** Lanza si el curso no existe o no es del usuario: nunca se confia en un id que venga del cliente. */
export async function obtenerCursoDelUsuario(idUsuario: number, idCurso: number) {
  const curso = await prisma.curso.findFirst({
    where: { idCurso, idUsuario },
    include: {
      horarios: { orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }] },
      evaluaciones: { orderBy: { fechaCierre: "asc" } },
      importadoDe: { select: { nombre: true, usuario: { select: { nombre: true, apellidos: true } } } },
    },
  });
  if (!curso) throw new ErrorDeNegocio("Curso no encontrado");
  return curso;
}

export async function crearCurso(idUsuario: number, datos: z.infer<typeof crearCursoSchema>) {
  return prisma.curso.create({
    data: {
      idUsuario,
      nombre: datos.nombre,
      codigo: datos.codigo,
      docente: datos.docente || null,
      modalidad: datos.modalidad,
      horarios: {
        create: datos.dias.map((diaSemana) => ({
          diaSemana,
          horaInicio: horaATime(datos.horaInicio),
          horaFin: horaATime(datos.horaFin),
        })),
      },
    },
  });
}

export async function actualizarCurso(
  idUsuario: number,
  idCurso: number,
  datos: z.infer<typeof actualizarCursoSchema>,
) {
  const actual = await obtenerCursoDelUsuario(idUsuario, idCurso);
  // En una copia importada nombre, docente y modalidad son del curso original: se ignoran aquí.
  const importado = actual.importadoDeIdCurso !== null;

  return prisma.$transaction(async (tx) => {
    const curso = await tx.curso.update({
      where: { idCurso },
      data: importado
        ? { codigo: datos.codigo, activo: datos.activo }
        : {
            nombre: datos.nombre,
            codigo: datos.codigo,
            docente: datos.docente || null,
            modalidad: datos.modalidad ?? null,
            activo: datos.activo,
          },
    });

    // Sincroniza las copias de quienes siguen en un grupo de este curso (nunca "activo": es de cada quien).
    const vigentes = await tx.grupoIntegrante.findMany({
      where: { estadoInvitacion: "aceptada", grupo: { evaluacion: { idCurso } } },
      select: { idUsuario: true },
      distinct: ["idUsuario"],
    });
    await tx.curso.updateMany({
      where: { importadoDeIdCurso: idCurso, idUsuario: { in: vigentes.map((v) => v.idUsuario) } },
      data: { nombre: curso.nombre, docente: curso.docente, modalidad: curso.modalidad },
    });

    return curso;
  });
}

/** El usuario sigue aceptado en algún grupo nacido de una evaluación de ese curso original. */
async function sigueVinculadoAlCurso(db: Pick<Prisma.TransactionClient, "grupoIntegrante">, idUsuario: number, idCursoFuente: number) {
  const vinculo = await db.grupoIntegrante.findFirst({
    where: { idUsuario, estadoInvitacion: "aceptada", grupo: { evaluacion: { idCurso: idCursoFuente } } },
    select: { idIntegrante: true },
  });
  return vinculo !== null;
}

/** Grupos de este usuario ligados a evaluaciones de sus cursos: el borrado los desvincula (SetNull). */
export async function gruposVinculadosPorCurso(idUsuario: number) {
  const grupos = await prisma.grupo.findMany({
    where: { evaluacion: { curso: { idUsuario } } },
    select: { evaluacion: { select: { idEvaluacion: true, idCurso: true } } },
  });
  const porCurso = new Map<number, number>();
  const porEvaluacion = new Map<number, number>();
  for (const { evaluacion } of grupos) {
    if (!evaluacion) continue;
    porCurso.set(evaluacion.idCurso, (porCurso.get(evaluacion.idCurso) ?? 0) + 1);
    porEvaluacion.set(evaluacion.idEvaluacion, (porEvaluacion.get(evaluacion.idEvaluacion) ?? 0) + 1);
  }
  return { porCurso, porEvaluacion };
}

export async function alternarActivoCurso(idUsuario: number, idCurso: number) {
  const curso = await obtenerCursoDelUsuario(idUsuario, idCurso);
  return prisma.curso.update({ where: { idCurso }, data: { activo: !curso.activo } });
}

/**
 * Borra el curso y, en cascada, sus horarios y evaluaciones (ver schema.prisma). Si otro
 * usuario lo habia importado, su copia queda huerfana (importado_de_id_curso -> NULL) pero
 * conserva sus propios datos: no se le borra nada a nadie mas.
 */
export async function eliminarCurso(idUsuario: number, idCurso: number) {
  await obtenerCursoDelUsuario(idUsuario, idCurso);
  await prisma.curso.delete({ where: { idCurso } });
}

/**
 * El invitado a un grupo que nace de un curso del anfitrion puede traerse ese curso a los suyos.
 * Nunca aplica al propio dueño del curso. Si ya lo trajo, no se duplica (solo se sincroniza). Si
 * tiene un curso propio (no importado) con el mismo codigo, se enlaza a ese y se sobrescriben
 * nombre/docente/modalidad; sus sesiones y evaluaciones que coincidan se enlazan sin duplicarse.
 * Un curso ya importado de otro original no se pisa: se crea una copia nueva.
 */
export async function importarCursoDesdeGrupo(idUsuario: number, idGrupo: number) {
  return ejecutarCambioDeGrupo(async (tx) => {
    const integrante = await tx.grupoIntegrante.findUnique({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    });
    if (!integrante || integrante.estadoInvitacion !== "aceptada") {
      throw new ErrorDeNegocio("No eres integrante de este grupo");
    }

    const grupo = await tx.grupo.findUnique({
      where: { idGrupo },
      include: { evaluacion: { include: { curso: true } } },
    });
    const cursoFuente = grupo?.evaluacion?.curso;
    if (!cursoFuente) throw new ErrorDeNegocio("Este grupo no tiene un curso vinculado");
    if (cursoFuente.idUsuario === idUsuario) throw new ErrorDeNegocio("Ya es tu curso");

    let existente = await tx.curso.findFirst({ where: { idUsuario, importadoDeIdCurso: cursoFuente.idCurso } });
    if (!existente && cursoFuente.codigo) {
      existente = await tx.curso.findFirst({
        where: { idUsuario, importadoDeIdCurso: null, codigo: { equals: cursoFuente.codigo, mode: "insensitive" } },
        orderBy: { fechaCreacion: "asc" },
      });
    }

    const datosSincronizados = {
      nombre: cursoFuente.nombre,
      docente: cursoFuente.docente,
      modalidad: cursoFuente.modalidad,
      importadoDeIdCurso: cursoFuente.idCurso,
    };

    const cursoLocal = existente
      ? await tx.curso.update({ where: { idCurso: existente.idCurso }, data: datosSincronizados })
      : await tx.curso.create({ data: { idUsuario, codigo: cursoFuente.codigo, ...datosSincronizados } });

    await sincronizarListasDeCurso(tx, cursoFuente.idCurso, cursoLocal.idCurso);

    return cursoLocal;
  });
}

type HorarioFila = { idHorario: number; diaSemana: number; horaInicio: Date; horaFin: Date; importadoDeIdHorario: number | null };
type EvaluacionFila = {
  idEvaluacion: number;
  nombre: string;
  fechaCierre: Date;
  fechaApertura: Date | null;
  requiereEntrega: boolean;
  importadoDeIdEvaluacion: number | null;
};

function mismaFranja(a: HorarioFila, b: HorarioFila) {
  return a.diaSemana === b.diaSemana && a.horaInicio.getTime() === b.horaInicio.getTime() && a.horaFin.getTime() === b.horaFin.getTime();
}

function evaluacionDifiere(local: EvaluacionFila, fuente: EvaluacionFila) {
  return (
    local.nombre !== fuente.nombre ||
    local.fechaCierre.getTime() !== fuente.fechaCierre.getTime() ||
    (local.fechaApertura?.getTime() ?? null) !== (fuente.fechaApertura?.getTime() ?? null) ||
    local.requiereEntrega !== fuente.requiereEntrega
  );
}

/**
 * Compara el curso original con la copia. Una sesion o evaluacion propia (sin enlace) que ya
 * coincide (mismo dia y franja / mismo nombre) se enlaza en vez de duplicarse. Todo lo demas se
 * empareja por el id importado, nunca por nombre.
 */
function planificarSincronizacion(
  horariosFuente: HorarioFila[],
  evaluacionesFuente: EvaluacionFila[],
  horariosLocales: HorarioFila[],
  evaluacionesLocales: EvaluacionFila[],
) {
  const horarios = {
    enlazar: [] as { local: HorarioFila; fuente: HorarioFila }[],
    actualizar: [] as { local: HorarioFila; fuente: HorarioFila }[],
    crear: [] as HorarioFila[],
  };
  const evaluaciones = {
    enlazar: [] as { local: EvaluacionFila; fuente: EvaluacionFila }[],
    actualizar: [] as { local: EvaluacionFila; fuente: EvaluacionFila }[],
    crear: [] as EvaluacionFila[],
  };

  const horariosTomados = new Set<number>();
  for (const fuente of horariosFuente) {
    const enlazado = horariosLocales.find((h) => h.importadoDeIdHorario === fuente.idHorario);
    if (enlazado) {
      if (!mismaFranja(enlazado, fuente)) horarios.actualizar.push({ local: enlazado, fuente });
      continue;
    }
    const propio = horariosLocales.find((h) => h.importadoDeIdHorario === null && !horariosTomados.has(h.idHorario) && mismaFranja(h, fuente));
    if (propio) {
      horariosTomados.add(propio.idHorario);
      horarios.enlazar.push({ local: propio, fuente });
    } else {
      horarios.crear.push(fuente);
    }
  }

  const clave = (nombre: string) => nombre.trim().toLowerCase();
  const evaluacionesTomadas = new Set<number>();
  for (const fuente of evaluacionesFuente) {
    const enlazada = evaluacionesLocales.find((e) => e.importadoDeIdEvaluacion === fuente.idEvaluacion);
    if (enlazada) {
      if (evaluacionDifiere(enlazada, fuente)) evaluaciones.actualizar.push({ local: enlazada, fuente });
      continue;
    }
    const propia = evaluacionesLocales.find(
      (e) => e.importadoDeIdEvaluacion === null && !evaluacionesTomadas.has(e.idEvaluacion) && clave(e.nombre) === clave(fuente.nombre),
    );
    if (propia) {
      evaluacionesTomadas.add(propia.idEvaluacion);
      evaluaciones.enlazar.push({ local: propia, fuente });
    } else {
      evaluaciones.crear.push(fuente);
    }
  }

  return { horarios, evaluaciones };
}

async function planDeCursos(db: Pick<Prisma.TransactionClient, "horarioCurso" | "evaluacion">, idCursoFuente: number, idCursoLocal: number) {
  const horariosFuente = await db.horarioCurso.findMany({ where: { idCurso: idCursoFuente } });
  const evaluacionesFuente = await db.evaluacion.findMany({ where: { idCurso: idCursoFuente } });
  const horariosLocales = await db.horarioCurso.findMany({ where: { idCurso: idCursoLocal } });
  const evaluacionesLocales = await db.evaluacion.findMany({ where: { idCurso: idCursoLocal } });
  return planificarSincronizacion(horariosFuente, evaluacionesFuente, horariosLocales, evaluacionesLocales);
}

/**
 * Trae del curso original lo que falte en horario_curso/evaluacion y actualiza lo que ya existe
 * (por el id importado). Nunca borra nada ni toca fecha_entrega ni el estado: son personales.
 */
async function sincronizarListasDeCurso(tx: Prisma.TransactionClient, idCursoFuente: number, idCursoLocal: number) {
  const plan = await planDeCursos(tx, idCursoFuente, idCursoLocal);

  for (const { local, fuente } of plan.horarios.enlazar) {
    await tx.horarioCurso.update({ where: { idHorario: local.idHorario }, data: { importadoDeIdHorario: fuente.idHorario } });
  }
  for (const { local, fuente } of plan.horarios.actualizar) {
    await tx.horarioCurso.update({
      where: { idHorario: local.idHorario },
      data: { diaSemana: fuente.diaSemana, horaInicio: fuente.horaInicio, horaFin: fuente.horaFin },
    });
  }
  for (const fuente of plan.horarios.crear) {
    await tx.horarioCurso.create({
      data: {
        idCurso: idCursoLocal,
        diaSemana: fuente.diaSemana,
        horaInicio: fuente.horaInicio,
        horaFin: fuente.horaFin,
        importadoDeIdHorario: fuente.idHorario,
      },
    });
  }

  for (const { local, fuente } of plan.evaluaciones.enlazar) {
    // La evaluacion propia conserva sus fechas: solo queda enlazada al original.
    await tx.evaluacion.update({ where: { idEvaluacion: local.idEvaluacion }, data: { importadoDeIdEvaluacion: fuente.idEvaluacion } });
  }
  for (const { local, fuente } of plan.evaluaciones.actualizar) {
    await tx.evaluacion.update({
      where: { idEvaluacion: local.idEvaluacion },
      data: {
        nombre: fuente.nombre,
        fechaCierre: fuente.fechaCierre,
        fechaApertura: fuente.fechaApertura,
        requiereEntrega: fuente.requiereEntrega,
      },
    });
  }
  for (const fuente of plan.evaluaciones.crear) {
    await tx.evaluacion.create({
      data: {
        idCurso: idCursoLocal,
        nombre: fuente.nombre,
        fechaCierre: fuente.fechaCierre,
        fechaApertura: fuente.fechaApertura,
        requiereEntrega: fuente.requiereEntrega,
        importadoDeIdEvaluacion: fuente.idEvaluacion,
        historial: { create: { accion: "creada" } },
      },
    });
  }
}

export interface CambiosPendientes {
  sesionesQueCambian: number;
  sesionesNuevas: number;
  evaluacionesQueCambian: number;
  evaluacionesNuevas: number;
}

/**
 * Para el aviso de "hay actualizaciones" y su confirmacion, sin traerlas todavia. Devuelve null
 * si no hay nada pendiente o si el usuario ya no esta en un grupo de ese curso (entonces no se
 * ofrece sincronizar). No se distingue una edicion propia de una del original (no hay columnas
 * para eso), por eso la confirmacion muestra antes que se va a sobrescribir.
 */
export async function cambiosPendientesDeCursoImportado(idCursoLocal: number): Promise<CambiosPendientes | null> {
  const local = await prisma.curso.findUnique({ where: { idCurso: idCursoLocal }, select: { idUsuario: true, importadoDeIdCurso: true } });
  if (!local?.importadoDeIdCurso) return null;
  if (!(await sigueVinculadoAlCurso(prisma, local.idUsuario, local.importadoDeIdCurso))) return null;

  const plan = await planDeCursos(prisma, local.importadoDeIdCurso, idCursoLocal);
  const cambios = {
    sesionesQueCambian: plan.horarios.actualizar.length,
    sesionesNuevas: plan.horarios.crear.length,
    evaluacionesQueCambian: plan.evaluaciones.actualizar.length,
    evaluacionesNuevas: plan.evaluaciones.crear.length,
  };
  return Object.values(cambios).some((n) => n > 0) ? cambios : null;
}

/** Texto del dialogo de confirmacion de "Traer actualizaciones": que se va a cambiar. */
export function describirCambiosPendientes(cambios: CambiosPendientes) {
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const partes = [
    cambios.sesionesQueCambian ? `se reemplazará${cambios.sesionesQueCambian === 1 ? "" : "n"} ${plural(cambios.sesionesQueCambian, "sesión", "sesiones")} de tu horario por ${cambios.sesionesQueCambian === 1 ? "la" : "las"} del curso original` : null,
    cambios.sesionesNuevas ? `se agregará${cambios.sesionesNuevas === 1 ? "" : "n"} ${plural(cambios.sesionesNuevas, "sesión nueva", "sesiones nuevas")}` : null,
    cambios.evaluacionesQueCambian ? `se actualizará${cambios.evaluacionesQueCambian === 1 ? "" : "n"} ${plural(cambios.evaluacionesQueCambian, "evaluación", "evaluaciones")}` : null,
    cambios.evaluacionesNuevas ? `se agregará${cambios.evaluacionesNuevas === 1 ? "" : "n"} ${plural(cambios.evaluacionesNuevas, "evaluación nueva", "evaluaciones nuevas")}` : null,
  ].filter((parte): parte is string => parte !== null);
  const texto = partes.join("; ");
  return `¿Traer actualizaciones? ${texto.charAt(0).toUpperCase()}${texto.slice(1)}. No se borra nada ni se toca tu avance.`;
}

/** Boton "traer actualizaciones" del invitado: trae lo nuevo/cambiado de horario y evaluaciones. */
export async function sincronizarCursoImportado(idUsuario: number, idCursoLocal: number) {
  const local = await obtenerCursoDelUsuario(idUsuario, idCursoLocal);
  const idFuente = local.importadoDeIdCurso;
  if (!idFuente) throw new ErrorDeNegocio("Este curso no esta importado de otro");
  await prisma.$transaction(async (tx) => {
    if (!(await sigueVinculadoAlCurso(tx, idUsuario, idFuente))) {
      throw new ErrorDeNegocio("Ya no perteneces a un grupo de este curso, así que no puedes traer sus actualizaciones");
    }
    await sincronizarListasDeCurso(tx, idFuente, idCursoLocal);
  });
}

/**
 * Para la seccion de Cursos: cursos de los grupos del usuario (via evaluacion) que todavia no
 * trajo, o que ya trajo pero el original tiene horario/evaluaciones nuevas. Asi no tiene que
 * escribir a mano el mismo curso o la misma evaluacion a la que ya lo invitaron.
 */
export async function listarCursosImportables(idUsuario: number) {
  const integraciones = await prisma.grupoIntegrante.findMany({
    where: { idUsuario, estadoInvitacion: "aceptada" },
    include: { grupo: { include: { evaluacion: { include: { curso: true } } } } },
  });

  const candidatos = new Map<number, { cursoFuente: Curso; idGrupo: number }>();
  for (const integrante of integraciones) {
    const cursoFuente = integrante.grupo.evaluacion?.curso;
    if (!cursoFuente || cursoFuente.idUsuario === idUsuario) continue;
    if (!candidatos.has(cursoFuente.idCurso)) {
      candidatos.set(cursoFuente.idCurso, { cursoFuente, idGrupo: integrante.idGrupo });
    }
  }

  const resultado = [];
  for (const { cursoFuente, idGrupo } of candidatos.values()) {
    const local = await prisma.curso.findFirst({
      where: { idUsuario, importadoDeIdCurso: cursoFuente.idCurso },
    });
    const cambios = local ? await cambiosPendientesDeCursoImportado(local.idCurso) : null;

    if (!local || cambios) {
      resultado.push({
        cursoFuente,
        idGrupo,
        idCursoLocal: local?.idCurso ?? null,
        hayActualizaciones: cambios !== null,
        confirmacion: cambios ? describirCambiosPendientes(cambios) : null,
      });
    }
  }

  return resultado;
}

export async function agregarHorario(
  idUsuario: number,
  idCurso: number,
  datos: z.infer<typeof crearHorarioSchema>,
) {
  const curso = await obtenerCursoDelUsuario(idUsuario, idCurso);
  if (curso.horarios.length > 0) {
    throw new ErrorDeNegocio("El curso ya tiene un horario; puedes editar sus sesiones existentes");
  }
  return prisma.horarioCurso.createMany({
    data: datos.dias.map((diaSemana) => ({
      idCurso,
      diaSemana,
      horaInicio: horaATime(datos.horaInicio),
      horaFin: horaATime(datos.horaFin),
    })),
  });
}

export async function actualizarHorarioCurso(
  idUsuario: number,
  idCurso: number,
  idHorario: number,
  datos: z.infer<typeof actualizarHorarioCursoSchema>,
) {
  await obtenerCursoDelUsuario(idUsuario, idCurso);
  const resultado = await prisma.horarioCurso.updateMany({
    where: { idHorario, idCurso },
    data: {
      diaSemana: datos.diaSemana,
      horaInicio: horaATime(datos.horaInicio),
      horaFin: horaATime(datos.horaFin),
    },
  });
  if (resultado.count === 0) throw new ErrorDeNegocio("La sesión del horario ya no existe");
  return resultado;
}

export async function agregarEvaluacion(
  idUsuario: number,
  idCurso: number,
  datos: z.infer<typeof crearEvaluacionSchema>,
) {
  const curso = await obtenerCursoDelUsuario(idUsuario, idCurso);
  const evaluacion = await prisma.evaluacion.create({
    data: {
      idCurso,
      nombre: datos.nombre,
      fechaApertura: datos.fechaApertura ? inicioDeDiaLimaAUtc(datos.fechaApertura) : null,
      fechaCierre: finDeDiaLimaAUtc(datos.fechaCierre),
      requiereEntrega: datos.requiereEntrega,
      historial: { create: { accion: "creada" } },
    },
  });

  // Excepcion aprobada por el usuario (2026-11-16): el aviso de evaluacion creada va al propio dueno.
  // Si falla no se revierte la evaluacion (ya existe): reintentar la accion la duplicaria.
  try {
    await crearNotificacion({
      idUsuario,
      tipo: "evaluacion_creada",
      ...plantillasNotificacion.evaluacionCreada(evaluacion.nombre, curso.nombre, idCurso, evaluacion.idEvaluacion, `el ${fechaCompleta(evaluacion.fechaCierre)}`),
    });
  } catch (error) {
    console.error("No se pudo crear la notificación de evaluación creada", error);
  }
  return evaluacion;
}

export async function eliminarEvaluacion(idUsuario: number, idCurso: number, idEvaluacion: number) {
  await obtenerCursoDelUsuario(idUsuario, idCurso);
  await prisma.evaluacion.deleteMany({ where: { idEvaluacion, idCurso } });
}

/** Lanza si la evaluacion no es de un curso del usuario. */
export async function obtenerEvaluacionDelUsuario(idUsuario: number, idEvaluacion: number) {
  const evaluacion = await prisma.evaluacion.findFirst({
    where: { idEvaluacion, curso: { idUsuario } },
    include: { historial: { orderBy: { fecha: "asc" } }, curso: { select: { idCurso: true, nombre: true } } },
  });
  if (!evaluacion) throw new ErrorDeNegocio("Evaluación no encontrada");
  return evaluacion;
}

/** Primera vez que el dueno abre el detalle: se registra una sola vez. */
export async function registrarVistaEvaluacion(idUsuario: number, idEvaluacion: number) {
  await prisma.$transaction(async (tx) => {
    const actualizada = await tx.evaluacion.updateMany({
      where: { idEvaluacion, curso: { idUsuario }, fechaVista: null },
      data: { fechaVista: new Date() },
    });
    if (actualizada.count) await tx.evaluacionHistorial.create({ data: { idEvaluacion, accion: "vista" } });
  });
}

export async function cambiarEstadoEvaluacion(idUsuario: number, idEvaluacion: number, destino: EstadoEvaluacion, motivo?: string) {
  await prisma.$transaction(async (tx) => {
    const evaluacion = await tx.evaluacion.findFirst({ where: { idEvaluacion, curso: { idUsuario } } });
    if (!evaluacion) throw new ErrorDeNegocio("Evaluación no encontrada");
    const validacion = transicionEvaluacionValida(evaluacion, destino);
    if (!validacion.ok) throw new ErrorDeNegocio(validacion.mensaje);
    const motivoLimpio = motivo?.trim();
    if (validacion.conMotivo && !motivoLimpio) throw new ErrorDeNegocio("Escribe el motivo");

    // Solo escribe si el estado sigue siendo el leido: un doble clic no duplica el historial.
    const actualizada = await tx.evaluacion.updateMany({ where: { idEvaluacion, estado: evaluacion.estado }, data: { estado: destino } });
    if (actualizada.count === 0) {
      const vigente = await tx.evaluacion.findUnique({ where: { idEvaluacion }, select: { estado: true } });
      if (vigente?.estado === destino) return;
      throw new ErrorDeNegocio("La evaluación cambió mientras guardabas. Actualiza la página");
    }
    await tx.evaluacionHistorial.create({
      data: {
        idEvaluacion,
        accion: "estado",
        valorAnterior: evaluacion.estado,
        valorNuevo: validacion.conMotivo && motivoLimpio ? valorConMotivo(destino, motivoLimpio) : destino,
      },
    });
  });
}

/** Marca o desmarca la entrega autodeclarada. Una evaluacion terminada no se puede desmarcar. */
export async function marcarEvaluacionEntregada(
  idUsuario: number,
  idCurso: number,
  idEvaluacion: number,
  entregada = true,
) {
  await obtenerCursoDelUsuario(idUsuario, idCurso);
  await prisma.$transaction(async (tx) => {
    const evaluacion = await tx.evaluacion.findFirst({ where: { idEvaluacion, idCurso } });
    if (!evaluacion) throw new ErrorDeNegocio("Evaluación no encontrada");
    if (!evaluacion.requiereEntrega) throw new ErrorDeNegocio("Esta evaluación no requiere entrega");
    if (evaluacion.estado === "descartada") throw new ErrorDeNegocio("Restaura la evaluación antes de cambiar su entrega");
    if (!entregada && evaluacion.estado === "completada") throw new ErrorDeNegocio("Reabre la evaluación antes de quitar la entrega");
    if (Boolean(evaluacion.fechaEntrega) === entregada) return;
    await tx.evaluacion.update({ where: { idEvaluacion }, data: { fechaEntrega: entregada ? new Date() : null } });
    await tx.evaluacionHistorial.create({
      data: { idEvaluacion, accion: "entrega", valorAnterior: entregada ? null : "entregada", valorNuevo: entregada ? "entregada" : null },
    });
  });
}
