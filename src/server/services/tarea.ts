import { prisma } from "@/server/db/client";
import { crearNotificacion } from "@/server/notifications/crear-notificacion";
import { plantillasNotificacion } from "@/server/notifications/templates";
import { finDeDiaLimaAUtc } from "@/lib/dates";
import { ErrorDeNegocio } from "@/lib/errores";
import { filtrosTareaSchema, motivoDevolucionSchema, type crearTareaSchema } from "@/lib/validation/tarea";
import { valorHistorialDevolucion } from "@/lib/tarea-historial";
import type { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client";
import { ejecutarCambioDeGrupo } from "./cambio-grupo";

type EstadoDb = "pendiente" | "en_progreso" | "en_revision" | "completada";
type RolDb = "lider" | "miembro" | "observador";

async function requerirIntegranteActivo(idUsuario: number, idGrupo: number, db: Prisma.TransactionClient = prisma) {
  const integrante = await db.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    include: { grupo: { select: { estado: true, fechaLimite: true } } },
  });
  if (!integrante || integrante.estadoInvitacion !== "aceptada") {
    throw new ErrorDeNegocio("No eres integrante de este grupo");
  }
  return integrante;
}

async function requerirIntegranteQuePuedeModificar(idUsuario: number, idGrupo: number, tx: Prisma.TransactionClient) {
  const integrante = await requerirIntegranteActivo(idUsuario, idGrupo, tx);
  if (integrante.grupo.estado !== "activo") throw new ErrorDeNegocio("El grupo está finalizado y es de solo lectura");
  if (integrante.rol === "observador") throw new ErrorDeNegocio("Los observadores no pueden modificar tareas");
  return integrante;
}

async function validarAsignable(idGrupo: number, idUsuario: number, tx: Prisma.TransactionClient) {
  const integrante = await tx.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
  });
  if (!integrante || integrante.estadoInvitacion !== "aceptada" || integrante.rol === "observador") {
    throw new ErrorDeNegocio("Esa persona no puede ser asignada en este grupo");
  }
}

/** Reglas de transicion de AGENTS.md 8.4, como funcion pura y testeable. */
export function verificarTransicion(params: {
  estadoActual: EstadoDb;
  nuevoEstado: EstadoDb;
  tieneAsignado: boolean;
  actorEsAsignado: boolean;
  actorRol: RolDb;
}) {
  const { estadoActual, nuevoEstado, tieneAsignado, actorEsAsignado, actorRol } = params;
  if (actorRol === "observador") throw new ErrorDeNegocio("Los observadores no pueden cambiar tareas");

  if (estadoActual === "pendiente" && nuevoEstado === "en_progreso") {
    if (!tieneAsignado) throw new ErrorDeNegocio("Asigna un responsable antes de empezar la tarea");
    if (!actorEsAsignado && actorRol !== "lider") {
      throw new ErrorDeNegocio("Solo el asignado o el lider pueden empezarla");
    }
    return;
  }
  if (estadoActual === "en_progreso" && nuevoEstado === "en_revision") {
    if (!actorEsAsignado) throw new ErrorDeNegocio("Solo el asignado puede pasarla a revision");
    return;
  }
  if (
    estadoActual === "en_revision" &&
    (nuevoEstado === "completada" || nuevoEstado === "en_progreso")
  ) {
    if (actorEsAsignado) throw new ErrorDeNegocio("El asignado no puede confirmar ni devolverse su propia tarea");
    return;
  }
  throw new ErrorDeNegocio(`No se puede pasar de "${estadoActual}" a "${nuevoEstado}"`);
}

/** La fecha es opcional, pero si existe debe servir para coordinar el trabajo real del grupo. */
export function validarFechaLimiteTarea(fechaLimite: Date | null, fechaLimiteGrupo: Date | null, ahora = new Date()) {
  if (!fechaLimite) return;
  if (fechaLimite < ahora) throw new ErrorDeNegocio("La fecha límite de la tarea no puede estar en el pasado");
  if (fechaLimiteGrupo && fechaLimite > fechaLimiteGrupo) {
    throw new ErrorDeNegocio("La fecha límite de la tarea no puede superar la fecha límite del grupo");
  }
}

/** Para el "Inicio": tareas activas asignadas al usuario en cualquiera de sus grupos. */
export async function listarTareasAsignadasAlUsuario(idUsuario: number, limite = 8) {
  return prisma.tarea.findMany({
    where: {
      idAsignado: idUsuario,
      estado: { not: "completada" },
      grupo: {
        estado: "activo",
        integrantes: { some: { idUsuario, estadoInvitacion: "aceptada", rol: { not: "observador" } } },
      },
    },
    include: {
      grupo: {
        include: {
          evaluacion: { include: { curso: true } },
          integrantes: {
            where: { estadoInvitacion: "aceptada" },
            select: {
              usuario: { select: { idUsuario: true, nombre: true, apellidos: true, fotoUrl: true } },
            },
            orderBy: { fechaInvitacion: "asc" },
          },
        },
      },
    },
    orderBy: [{ fechaLimite: "asc" }, { fechaCreacion: "desc" }],
    take: limite,
  });
}

export async function listarTareasDelGrupo(
  idUsuario: number,
  idGrupo: number,
  filtros: { estado?: EstadoDb; idAsignado?: number; q?: string; foco?: "abiertas" | "mias" | "sin_asignar" | "vencidas" } = {},
) {
  await requerirIntegranteActivo(idUsuario, idGrupo);
  const parseo = filtrosTareaSchema.safeParse({ ...filtros, asignado: filtros.idAsignado });
  if (!parseo.success) throw new ErrorDeNegocio("Los filtros de tareas no son válidos");
  const { estado, asignado, q, foco } = parseo.data;
  const condiciones = [
    estado ? { estado } : {},
    asignado ? { idAsignado: asignado } : {},
    q
      ? {
          OR: [
            { titulo: { contains: q, mode: "insensitive" as const } },
            { descripcion: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {},
    foco === "abiertas" ? { estado: { not: "completada" as const } } : {},
    foco === "mias" ? { idAsignado: idUsuario, estado: { not: "completada" as const } } : {},
    foco === "sin_asignar" ? { idAsignado: null, estado: { not: "completada" as const } } : {},
    foco === "vencidas" ? { fechaLimite: { lt: new Date() }, estado: { not: "completada" as const } } : {},
  ];
  return prisma.tarea.findMany({
    where: {
      idGrupo,
      AND: condiciones,
    },
    include: { asignado: true, creador: true },
    orderBy: [{ fechaCreacion: "desc" }],
  });
}

export async function obtenerResumenTareasGrupo(idUsuario: number, idGrupo: number) {
  await requerirIntegranteActivo(idUsuario, idGrupo);
  const tareas = await prisma.tarea.findMany({
    where: { idGrupo },
    select: { estado: true, idAsignado: true, fechaLimite: true, peso: true },
  });
  const ahora = new Date();
  return {
    total: tareas.length,
    abiertas: tareas.filter((tarea) => tarea.estado !== "completada").length,
    mias: tareas.filter((tarea) => tarea.idAsignado === idUsuario && tarea.estado !== "completada").length,
    vencidas: tareas.filter(
      (tarea) => tarea.estado !== "completada" && tarea.fechaLimite !== null && tarea.fechaLimite < ahora,
    ).length,
    enRevision: tareas.filter((tarea) => tarea.estado === "en_revision").length,
    sinAsignar: tareas.filter((tarea) => tarea.idAsignado === null && tarea.estado !== "completada").length,
    pesoAbiertoPorUsuario: tareas
      .filter((tarea) => tarea.estado !== "completada" && tarea.idAsignado !== null)
      .reduce<Record<number, number>>((pesos, tarea) => {
        pesos[tarea.idAsignado!] = (pesos[tarea.idAsignado!] ?? 0) + tarea.peso;
        return pesos;
      }, {}),
  };
}

export async function obtenerTareaDelGrupo(idUsuario: number, idGrupo: number, idTarea: number) {
  await requerirIntegranteActivo(idUsuario, idGrupo);
  const tarea = await prisma.tarea.findFirst({
    where: { idTarea, idGrupo },
    include: {
      asignado: { select: { nombre: true, apellidos: true, fotoUrl: true } },
      creador: { select: { nombre: true, apellidos: true } },
      historial: {
        include: { usuario: { select: { nombre: true, apellidos: true } } },
        orderBy: [{ fecha: "desc" }, { idHistorial: "desc" }],
      },
    },
  });
  if (!tarea) throw new ErrorDeNegocio("Tarea no encontrada");
  return tarea;
}

export async function crearTarea(
  idActor: number,
  idGrupo: number,
  datos: z.infer<typeof crearTareaSchema>,
) {
  if (!datos.idAsignado) throw new ErrorDeNegocio("Selecciona un responsable");
  if (!datos.fechaLimite) throw new ErrorDeNegocio("La fecha límite es obligatoria");
  const idAsignado = Number(datos.idAsignado);
  const tarea = await ejecutarCambioDeGrupo(async (tx) => {
    const integrante = await requerirIntegranteQuePuedeModificar(idActor, idGrupo, tx);
    await validarAsignable(idGrupo, idAsignado, tx);
    const fechaLimite = finDeDiaLimaAUtc(datos.fechaLimite);
    validarFechaLimiteTarea(fechaLimite, integrante.grupo.fechaLimite);
    return tx.tarea.create({
      data: {
        idGrupo,
        idCreador: idActor,
        idAsignado,
        titulo: datos.titulo,
        descripcion: datos.descripcion || null,
        peso: datos.peso,
        fechaLimite,
        historial: { create: [{ idUsuario: idActor, accion: "creada" }] },
      },
    });
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
  const nuevoIdAsignado = nuevoIdAsignadoRaw ? Number(nuevoIdAsignadoRaw) : null;
  const resultado = await ejecutarCambioDeGrupo(async (tx) => {
    const integrante = await requerirIntegranteQuePuedeModificar(idActor, idGrupo, tx);
    const tarea = await tx.tarea.findFirst({ where: { idTarea, idGrupo } });
    if (!tarea) throw new ErrorDeNegocio("Tarea no encontrada");
    if (tarea.estado === "completada") throw new ErrorDeNegocio("Una tarea completada no se puede reasignar");
    if (tarea.estado === "en_revision") {
      throw new ErrorDeNegocio("Devuelve la tarea a progreso antes de cambiar su responsable");
    }
    if (tarea.estado === "en_progreso" && integrante.rol !== "lider") {
      throw new ErrorDeNegocio("Solo el líder puede reasignar una tarea en progreso");
    }
    if (nuevoIdAsignado === tarea.idAsignado) return { tarea, cambio: false };
    if (nuevoIdAsignado) await validarAsignable(idGrupo, nuevoIdAsignado, tx);

    const vuelveAPendiente = tarea.estado === "en_progreso";
    const actualizada = await tx.tarea.update({
      where: { idTarea },
      data: {
        idAsignado: nuevoIdAsignado,
        ...(vuelveAPendiente ? { estado: "pendiente", fechaTerminada: null } : {}),
      },
    });
    await tx.tareaHistorial.create({
      data: {
        idTarea,
        idUsuario: idActor,
        accion: "reasignada",
        valorAnterior: tarea.idAsignado ? String(tarea.idAsignado) : null,
        valorNuevo: nuevoIdAsignado ? String(nuevoIdAsignado) : null,
      },
    });
    if (vuelveAPendiente) {
      await tx.tareaHistorial.create({
        data: {
          idTarea,
          idUsuario: idActor,
          accion: "estado",
          valorAnterior: "en_progreso",
          valorNuevo: "pendiente",
        },
      });
    }
    return { tarea: actualizada, cambio: true };
  });
  const { tarea, cambio } = resultado;

  if (cambio && nuevoIdAsignado && nuevoIdAsignado !== idActor) {
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
  motivoDevolucion = "",
) {
  const tarea = await ejecutarCambioDeGrupo(async (tx) => {
    const integrante = await requerirIntegranteQuePuedeModificar(idActor, idGrupo, tx);
    const tarea = await tx.tarea.findFirst({ where: { idTarea, idGrupo } });
    if (!tarea) throw new ErrorDeNegocio("Tarea no encontrada");

    verificarTransicion({
      estadoActual: tarea.estado,
      nuevoEstado,
      tieneAsignado: tarea.idAsignado !== null,
      actorEsAsignado: tarea.idAsignado === idActor,
      actorRol: integrante.rol,
    });

    const esDevolucion = tarea.estado === "en_revision" && nuevoEstado === "en_progreso";
    const motivoValidado = esDevolucion ? motivoDevolucionSchema.safeParse(motivoDevolucion) : null;
    if (motivoValidado && !motivoValidado.success) {
      throw new ErrorDeNegocio(motivoValidado.error.issues[0].message);
    }

    const estadoAnterior = tarea.estado;
    const fechaTerminada =
      nuevoEstado === "en_revision"
        ? new Date()
        : estadoAnterior === "en_revision" && nuevoEstado === "en_progreso"
          ? null
          : tarea.fechaTerminada;

    await tx.tarea.update({ where: { idTarea }, data: { estado: nuevoEstado, fechaTerminada } });
    await tx.tareaHistorial.create({
      data: {
        idTarea,
        idUsuario: idActor,
        accion: "estado",
        valorAnterior: estadoAnterior,
        valorNuevo: esDevolucion
          ? valorHistorialDevolucion(motivoValidado!.data)
          : nuevoEstado,
      },
    });
    return tarea;
  });

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
  } else if (nuevoEstado === "en_progreso" && tarea.estado === "en_revision" && tarea.idAsignado) {
    await crearNotificacion({
      idUsuario: tarea.idAsignado,
      tipo: "tarea_devuelta",
      idGrupo,
        ...plantillasNotificacion.tareaDevuelta(tarea.titulo, idGrupo, motivoDevolucion.trim()),
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
