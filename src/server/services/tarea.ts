import { prisma } from "@/server/db/client";
import { crearNotificacion } from "@/server/notifications/crear-notificacion";
import { plantillasNotificacion } from "@/server/notifications/templates";
import { finDeDiaLimaAUtc } from "@/lib/dates";
import type { crearTareaSchema } from "@/lib/validation/tarea";
import type { z } from "zod";

type EstadoDb = "pendiente" | "en_progreso" | "en_revision" | "completada";
type RolDb = "lider" | "miembro" | "observador";

async function requerirIntegranteActivo(idUsuario: number, idGrupo: number) {
  const integrante = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
  });
  if (!integrante || integrante.estadoInvitacion !== "aceptada") {
    throw new Error("No eres integrante de este grupo");
  }
  return integrante;
}

async function validarAsignable(idGrupo: number, idUsuario: number) {
  const integrante = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
  });
  if (!integrante || integrante.estadoInvitacion !== "aceptada" || integrante.rol === "observador") {
    throw new Error("Esa persona no puede ser asignada en este grupo");
  }
}

/** Reglas de transicion de AGENTS.md 8.4, como funcion pura y testeable. */
export function verificarTransicion(params: {
  estadoActual: EstadoDb;
  nuevoEstado: EstadoDb;
  actorEsAsignado: boolean;
  actorRol: RolDb;
}) {
  const { estadoActual, nuevoEstado, actorEsAsignado, actorRol } = params;
  if (actorRol === "observador") throw new Error("Los observadores no pueden cambiar tareas");

  if (estadoActual === "pendiente" && nuevoEstado === "en_progreso") {
    if (!actorEsAsignado && actorRol !== "lider") {
      throw new Error("Solo el asignado o el lider pueden empezarla");
    }
    return;
  }
  if (estadoActual === "en_progreso" && nuevoEstado === "en_revision") {
    if (!actorEsAsignado) throw new Error("Solo el asignado puede pasarla a revision");
    return;
  }
  if (
    estadoActual === "en_revision" &&
    (nuevoEstado === "completada" || nuevoEstado === "en_progreso")
  ) {
    if (actorEsAsignado) throw new Error("El asignado no puede confirmar ni devolverse su propia tarea");
    return;
  }
  throw new Error(`No se puede pasar de "${estadoActual}" a "${nuevoEstado}"`);
}

/** Para el "Inicio": tareas activas asignadas al usuario en cualquiera de sus grupos. */
export async function listarTareasAsignadasAlUsuario(idUsuario: number, limite = 8) {
  return prisma.tarea.findMany({
    where: { idAsignado: idUsuario, estado: { not: "completada" } },
    include: {
      grupo: { include: { evaluacion: { include: { curso: true } } } },
    },
    orderBy: [{ fechaLimite: "asc" }, { fechaCreacion: "desc" }],
    take: limite,
  });
}

export async function listarTareasDelGrupo(
  idUsuario: number,
  idGrupo: number,
  filtros: { estado?: EstadoDb; idAsignado?: number } = {},
) {
  await requerirIntegranteActivo(idUsuario, idGrupo);
  return prisma.tarea.findMany({
    where: {
      idGrupo,
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.idAsignado ? { idAsignado: filtros.idAsignado } : {}),
    },
    include: { asignado: true, creador: true },
    orderBy: [{ fechaCreacion: "desc" }],
  });
}

export async function crearTarea(
  idActor: number,
  idGrupo: number,
  datos: z.infer<typeof crearTareaSchema>,
) {
  const integrante = await requerirIntegranteActivo(idActor, idGrupo);
  if (integrante.rol === "observador") throw new Error("Los observadores no pueden crear tareas");

  const idAsignado = datos.idAsignado ? Number(datos.idAsignado) : null;
  if (idAsignado) await validarAsignable(idGrupo, idAsignado);

  const tarea = await prisma.tarea.create({
    data: {
      idGrupo,
      idCreador: idActor,
      idAsignado,
      titulo: datos.titulo,
      descripcion: datos.descripcion || null,
      peso: datos.peso,
      fechaLimite: datos.fechaLimite ? finDeDiaLimaAUtc(datos.fechaLimite) : null,
      historial: { create: [{ idUsuario: idActor, accion: "creada" }] },
    },
  });

  if (idAsignado && idAsignado !== idActor) {
    await crearNotificacion({
      idUsuario: idAsignado,
      tipo: "tarea_asignada",
      idGrupo,
      ...plantillasNotificacion.tareaAsignada(tarea.titulo, idGrupo),
    });
  }

  return tarea;
}

export async function reasignarTarea(
  idActor: number,
  idGrupo: number,
  idTarea: number,
  nuevoIdAsignadoRaw: string,
) {
  const integrante = await requerirIntegranteActivo(idActor, idGrupo);
  if (integrante.rol === "observador") throw new Error("Los observadores no pueden reasignar tareas");

  const tarea = await prisma.tarea.findFirst({ where: { idTarea, idGrupo } });
  if (!tarea) throw new Error("Tarea no encontrada");

  const nuevoIdAsignado = nuevoIdAsignadoRaw ? Number(nuevoIdAsignadoRaw) : null;
  if (nuevoIdAsignado === tarea.idAsignado) return tarea;
  if (nuevoIdAsignado) await validarAsignable(idGrupo, nuevoIdAsignado);

  await prisma.$transaction([
    prisma.tarea.update({ where: { idTarea }, data: { idAsignado: nuevoIdAsignado } }),
    prisma.tareaHistorial.create({
      data: {
        idTarea,
        idUsuario: idActor,
        accion: "reasignada",
        valorAnterior: tarea.idAsignado ? String(tarea.idAsignado) : null,
        valorNuevo: nuevoIdAsignado ? String(nuevoIdAsignado) : null,
      },
    }),
  ]);

  if (nuevoIdAsignado && nuevoIdAsignado !== idActor) {
    await crearNotificacion({
      idUsuario: nuevoIdAsignado,
      tipo: "tarea_asignada",
      idGrupo,
      ...plantillasNotificacion.tareaAsignada(tarea.titulo, idGrupo),
    });
  }

  return tarea;
}

export async function cambiarEstadoTarea(
  idActor: number,
  idGrupo: number,
  idTarea: number,
  nuevoEstado: EstadoDb,
) {
  const integrante = await requerirIntegranteActivo(idActor, idGrupo);
  const tarea = await prisma.tarea.findFirst({ where: { idTarea, idGrupo } });
  if (!tarea) throw new Error("Tarea no encontrada");

  verificarTransicion({
    estadoActual: tarea.estado,
    nuevoEstado,
    actorEsAsignado: tarea.idAsignado === idActor,
    actorRol: integrante.rol,
  });

  const estadoAnterior = tarea.estado;
  const fechaTerminada =
    nuevoEstado === "en_revision"
      ? new Date()
      : estadoAnterior === "en_revision" && nuevoEstado === "en_progreso"
        ? null
        : tarea.fechaTerminada;

  await prisma.$transaction([
    prisma.tarea.update({ where: { idTarea }, data: { estado: nuevoEstado, fechaTerminada } }),
    prisma.tareaHistorial.create({
      data: {
        idTarea,
        idUsuario: idActor,
        accion: "estado",
        valorAnterior: estadoAnterior,
        valorNuevo: nuevoEstado,
      },
    }),
  ]);

  if (nuevoEstado === "en_revision") {
    const integrantesNotificables = await prisma.grupoIntegrante.findMany({
      where: { idGrupo, estadoInvitacion: "aceptada", rol: { not: "observador" } },
    });
    for (const destino of integrantesNotificables) {
      if (destino.idUsuario === tarea.idAsignado) continue;
      await crearNotificacion({
        idUsuario: destino.idUsuario,
        tipo: "tarea_en_revision",
        idGrupo,
        ...plantillasNotificacion.tareaEnRevision(tarea.titulo, idGrupo),
      });
    }
  } else if (nuevoEstado === "en_progreso" && estadoAnterior === "en_revision" && tarea.idAsignado) {
    await crearNotificacion({
      idUsuario: tarea.idAsignado,
      tipo: "tarea_devuelta",
      idGrupo,
      ...plantillasNotificacion.tareaDevuelta(tarea.titulo, idGrupo),
    });
  } else if (nuevoEstado === "completada" && tarea.idAsignado) {
    await crearNotificacion({
      idUsuario: tarea.idAsignado,
      tipo: "tarea_completada",
      idGrupo,
      ...plantillasNotificacion.tareaCompletada(tarea.titulo, idGrupo),
    });
  }
}
