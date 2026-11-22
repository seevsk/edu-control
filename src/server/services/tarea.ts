import { prisma } from "@/server/db/client";
import { crearNotificacion, notificarVarios } from "@/server/notifications/crear-notificacion";
import { plantillasNotificacion } from "@/server/notifications/templates";
import { finDeDiaLimaAUtc } from "@/lib/dates";
import { diaYMes } from "@/lib/formato-fecha";
import { fechaEnZonaLimaISO } from "@/lib/calendario";
import { ErrorDeNegocio } from "@/lib/errores";
import {
  filtrosTareaSchema,
  motivoCambioEstadoSchema,
  type crearTareaSchema,
  type editarTareaSchema,
} from "@/lib/validation/tarea";
import { valorHistorialConMotivo } from "@/lib/tarea-historial";
import { ESTADOS_TAREA_ABIERTOS, estaAbierta, type AccionConMotivo, type EstadoTarea } from "@/lib/estado-tarea";
import type { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client";
import { ejecutarCambioDeGrupo, MENSAJE_CONFLICTO_GRUPO } from "./cambio-grupo";

const MENSAJE_TAREA_YA_TOMADA = "Otra persona ya tomó esta tarea";

type RolDb = "lider" | "miembro" | "observador";

const SOLO_ABIERTAS = { estado: { in: [...ESTADOS_TAREA_ABIERTOS] } };

export async function requerirIntegranteActivo(idUsuario: number, idGrupo: number, db: Prisma.TransactionClient = prisma) {
  const integrante = await db.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    include: { grupo: { select: { estado: true, fechaLimite: true } } },
  });
  if (!integrante || integrante.estadoInvitacion !== "aceptada") {
    throw new ErrorDeNegocio("No eres integrante de este grupo");
  }
  return integrante;
}

export async function requerirIntegranteQuePuedeModificar(idUsuario: number, idGrupo: number, tx: Prisma.TransactionClient) {
  const integrante = await requerirIntegranteActivo(idUsuario, idGrupo, tx);
  if (integrante.grupo.estado !== "activo") throw new ErrorDeNegocio("El grupo está finalizado y es de solo lectura");
  if (integrante.rol === "observador") throw new ErrorDeNegocio("Los observadores no pueden modificar tareas");
  return integrante;
}

async function esAsignable(idGrupo: number, idUsuario: number, tx: Prisma.TransactionClient) {
  const integrante = await tx.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
  });
  return Boolean(integrante && integrante.estadoInvitacion === "aceptada" && integrante.rol !== "observador");
}

async function validarAsignable(idGrupo: number, idUsuario: number, tx: Prisma.TransactionClient) {
  if (!(await esAsignable(idGrupo, idUsuario, tx))) {
    throw new ErrorDeNegocio("Esa persona no puede ser asignada en este grupo");
  }
}

/** Reglas de transicion de AGENTS.md 8.4, como funcion pura y testeable. */
export function verificarTransicion(params: {
  estadoActual: EstadoTarea;
  nuevoEstado: EstadoTarea;
  tieneAsignado: boolean;
  actorEsAsignado: boolean;
  actorRol: RolDb;
}) {
  const { estadoActual, nuevoEstado, tieneAsignado, actorEsAsignado, actorRol } = params;
  if (actorRol === "observador") throw new ErrorDeNegocio("Los observadores no pueden cambiar tareas");
  const esLider = actorRol === "lider";

  if (nuevoEstado === "descartada") {
    if (!estaAbierta(estadoActual)) throw new ErrorDeNegocio("Solo se pueden descartar tareas abiertas");
    if (!esLider) throw new ErrorDeNegocio("Solo el líder puede descartar una tarea");
    return;
  }
  if (estadoActual === "descartada" && nuevoEstado === "pendiente") {
    if (!esLider) throw new ErrorDeNegocio("Solo el líder puede restaurar una tarea");
    return;
  }
  if (estadoActual === "completada" && nuevoEstado === "en_progreso") {
    if (!esLider) throw new ErrorDeNegocio("Solo el líder puede reabrir una tarea");
    if (!tieneAsignado) throw new ErrorDeNegocio("La tarea no tiene responsable para reabrirla");
    return;
  }
  if (estadoActual === "pendiente" && nuevoEstado === "en_progreso") {
    if (!tieneAsignado) throw new ErrorDeNegocio("Asigna un responsable antes de empezar la tarea");
    if (!actorEsAsignado && !esLider) {
      throw new ErrorDeNegocio("Solo el asignado o el lider pueden empezarla");
    }
    return;
  }
  if (estadoActual === "en_progreso" && nuevoEstado === "en_revision") {
    // Pasar a revision es enviar una entrega (servicio `entrega.ts`), no un cambio de estado suelto.
    throw new ErrorDeNegocio("Envía una entrega para pasar la tarea a revisión");
  }
  if (
    estadoActual === "en_revision" &&
    (nuevoEstado === "completada" || nuevoEstado === "en_progreso")
  ) {
    // Solo el lider aprueba o devuelve, incluso su propia tarea (queda marcada como autoaprobada).
    if (!esLider) throw new ErrorDeNegocio("Solo el líder puede aprobar o devolver una entrega");
    return;
  }
  throw new ErrorDeNegocio(`No se puede pasar de "${estadoActual}" a "${nuevoEstado}"`);
}

/** Transiciones "hacia atras" o de cierre que exigen dejar un motivo en el historial. */
export function accionConMotivo(estadoActual: EstadoTarea, nuevoEstado: EstadoTarea): AccionConMotivo | null {
  if (estadoActual === "en_revision" && nuevoEstado === "en_progreso") return "devolver";
  if (estadoActual === "completada" && nuevoEstado === "en_progreso") return "reabrir";
  if (nuevoEstado === "descartada") return "descartar";
  return null;
}

/** La fecha es opcional, pero si existe debe servir para coordinar el trabajo real del grupo. */
export function validarFechaLimiteTarea(fechaLimite: Date | null, fechaLimiteGrupo: Date | null, ahora = new Date()) {
  if (!fechaLimite) return;
  if (fechaLimite < ahora) throw new ErrorDeNegocio("La fecha límite de la tarea no puede estar en el pasado");
  // Se compara por día en Lima: la fecha de la tarea es "fin del día" y el grupo puede vencer a media jornada.
  if (fechaLimiteGrupo && fechaEnZonaLimaISO(fechaLimite) > fechaEnZonaLimaISO(fechaLimiteGrupo)) {
    throw new ErrorDeNegocio("La fecha límite de la tarea no puede superar la fecha límite del grupo");
  }
}

/** Para el "Inicio": tareas activas asignadas al usuario en cualquiera de sus grupos. */
export async function listarTareasAsignadasAlUsuario(idUsuario: number, limite = 8) {
  return prisma.tarea.findMany({
    where: {
      idAsignado: idUsuario,
      ...SOLO_ABIERTAS,
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

/** Tareas en revision que el usuario puede aprobar o devolver: solo las de los grupos que lidera (tambien las suyas). */
export async function listarTareasPorRevisar(idUsuario: number, limite = 20) {
  return prisma.tarea.findMany({
    where: {
      estado: "en_revision",
      grupo: {
        estado: "activo",
        integrantes: { some: { idUsuario, estadoInvitacion: "aceptada", rol: "lider" } },
      },
    },
    include: {
      asignado: { select: { idUsuario: true, nombre: true, apellidos: true, fotoUrl: true } },
      grupo: { select: { idGrupo: true, nombre: true, evaluacion: { select: { curso: { select: { idCurso: true, nombre: true } } } } } },
    },
    orderBy: [{ fechaTerminada: "asc" }],
    take: limite,
  });
}

export async function listarTareasDelGrupo(
  idUsuario: number,
  idGrupo: number,
  filtros: { estado?: EstadoTarea; idAsignado?: number; q?: string; foco?: "abiertas" | "mias" | "sin_asignar" | "vencidas" } = {},
) {
  await requerirIntegranteActivo(idUsuario, idGrupo);
  const parseo = filtrosTareaSchema.safeParse({ ...filtros, asignado: filtros.idAsignado });
  if (!parseo.success) throw new ErrorDeNegocio("Los filtros de tareas no son válidos");
  const { estado, asignado, q, foco } = parseo.data;
  const condiciones = [
    // Las descartadas solo aparecen cuando se filtran explicitamente.
    estado ? { estado } : { estado: { not: "descartada" as const } },
    asignado === "sin" ? { idAsignado: null } : asignado ? { idAsignado: asignado } : {},
    q
      ? {
          OR: [
            { titulo: { contains: q, mode: "insensitive" as const } },
            { descripcion: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {},
    foco === "abiertas" ? SOLO_ABIERTAS : {},
    foco === "mias" ? { idAsignado: idUsuario, ...SOLO_ABIERTAS } : {},
    foco === "sin_asignar" ? { idAsignado: null, ...SOLO_ABIERTAS } : {},
    foco === "vencidas" ? { fechaLimite: { lt: new Date() }, ...SOLO_ABIERTAS } : {},
  ];
  return prisma.tarea.findMany({
    where: {
      idGrupo,
      AND: condiciones,
    },
    include: {
      asignado: true,
      creador: true,
      historial: {
        select: { idHistorial: true, idUsuario: true, accion: true, valorAnterior: true, valorNuevo: true, fecha: true },
      },
      // Solo la entrega vigente y cuántos archivos trae, para el clip del tablero y la lista.
      entregas: {
        select: { _count: { select: { archivos: true } } },
        orderBy: [{ fechaEnvio: "desc" }, { idEntrega: "desc" }],
        take: 1,
      },
    },
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
  const abiertas = tareas.filter((tarea) => estaAbierta(tarea.estado));
  return {
    total: tareas.length,
    abiertas: abiertas.length,
    mias: abiertas.filter((tarea) => tarea.idAsignado === idUsuario).length,
    vencidas: abiertas.filter((tarea) => tarea.fechaLimite !== null && tarea.fechaLimite < ahora).length,
    enRevision: tareas.filter((tarea) => tarea.estado === "en_revision").length,
    sinAsignar: abiertas.filter((tarea) => tarea.idAsignado === null).length,
    descartadas: tareas.filter((tarea) => tarea.estado === "descartada").length,
    pesoAbiertoPorUsuario: abiertas
      .filter((tarea) => tarea.idAsignado !== null)
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
      // Sin el binario: solo los metadatos de cada archivo.
      entregas: {
        include: {
          autor: { select: { idUsuario: true, nombre: true, apellidos: true, fotoUrl: true } },
          revisor: { select: { idUsuario: true, nombre: true, apellidos: true, fotoUrl: true } },
          archivos: { select: { idArchivo: true, nombre: true, mime: true, tamano: true }, orderBy: { idArchivo: "asc" } },
        },
        orderBy: [{ fechaEnvio: "desc" }, { idEntrega: "desc" }],
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
  if (!datos.fechaLimite) throw new ErrorDeNegocio("La fecha límite es obligatoria");
  // El responsable es opcional: sin él la tarea queda "Sin asignar" hasta que alguien la tome o el líder la asigne.
  const idAsignado = datos.idAsignado ? Number(datos.idAsignado) : null;
  const tarea = await ejecutarCambioDeGrupo(async (tx) => {
    const integrante = await requerirIntegranteQuePuedeModificar(idActor, idGrupo, tx);
    if (idAsignado !== null) await validarAsignable(idGrupo, idAsignado, tx);
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
        historial: {
          create: [
            { idUsuario: idActor, accion: "creada" },
            // Quien se asigna su propia tarea ya la vio al crearla.
            ...(idAsignado === idActor ? [{ idUsuario: idActor, accion: "vista" as const }] : []),
          ],
        },
      },
    });
  });

  if (idAsignado && idAsignado !== idActor) {
    await crearNotificacion({
      idUsuario: idAsignado,
      tipo: "tarea_asignada",
      idGrupo,
      ...plantillasNotificacion.tareaAsignada(tarea.titulo, idGrupo, tarea.idTarea),
    });
  }

  return tarea;
}

/**
 * "Tomar tarea": un integrante se asigna a si mismo una tarea pendiente sin responsable.
 * Es una reasignacion normal (historial `reasignada` + `vista`, sin notificar al propio actor).
 * Si dos personas la toman a la vez, la transaccion serializable deja ganar a una sola.
 */
export async function tomarTarea(idActor: number, idGrupo: number, idTarea: number) {
  const intentar = () =>
    ejecutarCambioDeGrupo(async (tx) => {
      await requerirIntegranteQuePuedeModificar(idActor, idGrupo, tx);
      const tarea = await tx.tarea.findFirst({ where: { idTarea, idGrupo } });
      if (!tarea) throw new ErrorDeNegocio("Tarea no encontrada");
      if (tarea.idAsignado === idActor) throw new ErrorDeNegocio("Esta tarea ya es tuya");
      if (tarea.idAsignado !== null) throw new ErrorDeNegocio(MENSAJE_TAREA_YA_TOMADA);
      if (tarea.estado !== "pendiente") throw new ErrorDeNegocio("Solo se pueden tomar tareas pendientes");
      // Condicion en el propio UPDATE: aun sin conflicto serializable, solo una toma puede ganar.
      const { count } = await tx.tarea.updateMany({ where: { idTarea, idAsignado: null }, data: { idAsignado: idActor } });
      if (count === 0) throw new ErrorDeNegocio(MENSAJE_TAREA_YA_TOMADA);
      await tx.tareaHistorial.create({
        data: { idTarea, idUsuario: idActor, accion: "reasignada", valorAnterior: null, valorNuevo: String(idActor) },
      });
      await tx.tareaHistorial.create({ data: { idTarea, idUsuario: idActor, accion: "vista" } });
      return { ...tarea, idAsignado: idActor };
    });
  try {
    return await intentar();
  } catch (error) {
    // El perdedor de una toma simultanea recibe el conflicto del grupo: se reintenta una vez y ve que ya tiene dueño.
    if (error instanceof ErrorDeNegocio && error.message === MENSAJE_CONFLICTO_GRUPO) return intentar();
    throw error;
  }
}

/** Edicion de una tarea abierta: el lider o quien la creo. Peso y fecha limite quedan en el historial. */
export async function editarTarea(
  idActor: number,
  idGrupo: number,
  idTarea: number,
  datos: z.infer<typeof editarTareaSchema>,
) {
  const resultado = await ejecutarCambioDeGrupo(async (tx) => {
    const integrante = await requerirIntegranteQuePuedeModificar(idActor, idGrupo, tx);
    const tarea = await tx.tarea.findFirst({ where: { idTarea, idGrupo } });
    if (!tarea) throw new ErrorDeNegocio("Tarea no encontrada");
    if (integrante.rol !== "lider" && tarea.idCreador !== idActor) {
      throw new ErrorDeNegocio("Solo el líder o quien creó la tarea pueden editarla");
    }
    if (!estaAbierta(tarea.estado)) {
      throw new ErrorDeNegocio("Solo se pueden editar tareas abiertas");
    }

    const fechaLimite = finDeDiaLimaAUtc(datos.fechaLimite);
    const cambiaFecha = tarea.fechaLimite?.getTime() !== fechaLimite.getTime();
    const cambiaPeso = tarea.peso !== datos.peso;
    // Una fecha ya vencida se puede conservar al editar otros campos; solo se valida si cambia.
    if (cambiaFecha) validarFechaLimiteTarea(fechaLimite, integrante.grupo.fechaLimite);

    const actualizada = await tx.tarea.update({
      where: { idTarea },
      data: {
        titulo: datos.titulo,
        descripcion: datos.descripcion || null,
        peso: datos.peso,
        fechaLimite,
      },
    });
    if (cambiaFecha) {
      await tx.tareaHistorial.create({
        data: {
          idTarea,
          idUsuario: idActor,
          accion: "fecha_limite",
          valorAnterior: tarea.fechaLimite?.toISOString() ?? null,
          valorNuevo: fechaLimite.toISOString(),
        },
      });
    }
    if (cambiaPeso) {
      await tx.tareaHistorial.create({
        data: {
          idTarea,
          idUsuario: idActor,
          accion: "peso",
          valorAnterior: String(tarea.peso),
          valorNuevo: String(datos.peso),
        },
      });
    }
    return { tarea: actualizada, cambiaFecha };
  });

  const { tarea, cambiaFecha } = resultado;
  if (cambiaFecha && tarea.idAsignado && tarea.idAsignado !== idActor && tarea.fechaLimite) {
    await crearNotificacion({
      idUsuario: tarea.idAsignado,
      tipo: "tarea_reprogramada",
      idGrupo,
      ...plantillasNotificacion.tareaReprogramada(tarea.titulo, idGrupo, idTarea, diaYMes(tarea.fechaLimite)),
    });
  }
  return tarea;
}

/**
 * Registra la primera vez que el responsable actual abre la tarea. Se vuelve a registrar
 * si la tarea se le reasigna a otra persona. Es de mejor esfuerzo: nunca bloquea la pagina.
 */
export async function registrarVistaTarea(idUsuario: number, idGrupo: number, idTarea: number) {
  await ejecutarCambioDeGrupo(async (tx) => {
    const integrante = await requerirIntegranteActivo(idUsuario, idGrupo, tx);
    if (integrante.grupo.estado !== "activo") return;
    const tarea = await tx.tarea.findFirst({ where: { idTarea, idGrupo }, select: { idAsignado: true, estado: true } });
    if (!tarea || tarea.idAsignado !== idUsuario || !estaAbierta(tarea.estado)) return;

    const ultimo = await tx.tareaHistorial.findFirst({
      where: {
        idTarea,
        OR: [
          { accion: "creada" },
          { accion: "reasignada", valorNuevo: String(idUsuario) },
          { accion: "vista", idUsuario },
        ],
      },
      orderBy: [{ fecha: "desc" }, { idHistorial: "desc" }],
    });
    if (ultimo?.accion === "vista") return;
    await tx.tareaHistorial.create({ data: { idTarea, idUsuario, accion: "vista" } });
  });
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
    if (tarea.estado === "descartada") throw new ErrorDeNegocio("Restaura la tarea antes de cambiar su responsable");
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
    if (nuevoIdAsignado === idActor) {
      await tx.tareaHistorial.create({ data: { idTarea, idUsuario: idActor, accion: "vista" } });
    }
    return { tarea: actualizada, cambio: true };
  });
  const { tarea, cambio } = resultado;

  if (cambio && nuevoIdAsignado && nuevoIdAsignado !== idActor) {
    await crearNotificacion({
      idUsuario: nuevoIdAsignado,
      tipo: "tarea_asignada",
      idGrupo,
      ...plantillasNotificacion.tareaAsignada(tarea.titulo, idGrupo, tarea.idTarea),
    });
  }

  return tarea;
}

/** Avisa a los integrantes (no observadores, salvo el asignado) que una tarea paso a revision. */
export async function notificarTareaEnRevision(idGrupo: number, idTarea: number, titulo: string, idAsignado: number | null) {
  const destinos = await prisma.grupoIntegrante.findMany({
    where: { idGrupo, estadoInvitacion: "aceptada", rol: { not: "observador" } },
  });
  await notificarVarios(
    destinos
      .filter((destino) => destino.idUsuario !== idAsignado)
      .map((destino) => ({
        idUsuario: destino.idUsuario,
        tipo: "tarea_en_revision" as const,
        idGrupo,
        ...plantillasNotificacion.tareaEnRevision(titulo, idGrupo, idTarea),
      })),
  );
}

async function notificarAutoaprobacion(idGrupo: number, idTarea: number, titulo: string, idLider: number) {
  const destinos = await prisma.grupoIntegrante.findMany({
    where: { idGrupo, estadoInvitacion: "aceptada", rol: { not: "observador" }, idUsuario: { not: idLider } },
  });
  await notificarVarios(
    destinos.map((destino) => ({
      idUsuario: destino.idUsuario,
      tipo: "tarea_completada" as const,
      idGrupo,
      ...plantillasNotificacion.tareaAutoaprobada(titulo, idGrupo, idTarea),
    })),
  );
}

export async function cambiarEstadoTarea(
  idActor: number,
  idGrupo: number,
  idTarea: number,
  nuevoEstado: EstadoTarea,
  motivo = "",
) {
  const { tarea, accion, motivoValidado, asignadoPuedeRecibir } = await ejecutarCambioDeGrupo(async (tx) => {
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

    const estadoAnterior = tarea.estado;
    const accion = accionConMotivo(estadoAnterior, nuevoEstado);
    let motivoValidado = "";
    if (accion) {
      const parseo = motivoCambioEstadoSchema.safeParse(motivo);
      if (!parseo.success) throw new ErrorDeNegocio(parseo.error.issues[0].message);
      motivoValidado = parseo.data;
    }
    // Al devolver, reabrir o restaurar, si el responsable ya no puede recibir tareas (se retiro, es
    // observador o no hay), la tarea vuelve a Pendiente sin asignar para que el lider la reasigne:
    // nunca queda en progreso sin responsable.
    const asignadoPuedeRecibir = tarea.idAsignado !== null && (await esAsignable(idGrupo, tarea.idAsignado, tx));
    const vuelveSinResponsable =
      (accion === "reabrir" || accion === "devolver" || estadoAnterior === "descartada") &&
      !asignadoPuedeRecibir;
    const idAsignado = vuelveSinResponsable ? null : tarea.idAsignado;
    const estadoFinal: EstadoTarea = vuelveSinResponsable ? "pendiente" : nuevoEstado;
    const fechaTerminada =
      estadoFinal === "en_revision"
        ? new Date()
        : estadoFinal === "en_progreso" || estadoFinal === "pendiente"
          ? null
          : tarea.fechaTerminada;

    await tx.tarea.update({ where: { idTarea }, data: { estado: estadoFinal, fechaTerminada, idAsignado } });
    // Aprobar o devolver cierra la entrega vigente. Una tarea que llego a revision antes de existir
    // las entregas no tiene ninguna: el estado cambia igual.
    if (estadoAnterior === "en_revision" && (estadoFinal === "completada" || accion === "devolver")) {
      const pendientes = await tx.entrega.findMany({
        where: { idTarea, resultado: "en_revision" },
        orderBy: [{ fechaEnvio: "desc" }, { idEntrega: "desc" }],
        select: { idEntrega: true },
      });
      const [vigente, ...obsoletas] = pendientes;
      // Ninguna entrega anterior debe quedar "En revisión" si la tarea ya se resolvió.
      if (obsoletas.length > 0) {
        await tx.entrega.updateMany({
          where: { idEntrega: { in: obsoletas.map((entrega) => entrega.idEntrega) } },
          data: { resultado: "devuelta" },
        });
      }
      if (vigente) {
        await tx.entrega.update({
          where: { idEntrega: vigente.idEntrega },
          data: {
            resultado: estadoFinal === "completada" ? "aprobada" : "devuelta",
            idRevisor: idActor,
            fechaRevision: new Date(),
            motivoDevolucion: estadoFinal === "completada" ? null : motivoValidado,
          },
        });
      }
    }
    await tx.tareaHistorial.create({
      data: {
        idTarea,
        idUsuario: idActor,
        accion: "estado",
        valorAnterior: estadoAnterior,
        valorNuevo: accion ? valorHistorialConMotivo(estadoFinal, accion, motivoValidado) : estadoFinal,
      },
    });
    if (tarea.idAsignado !== null && idAsignado !== tarea.idAsignado) {
      await tx.tareaHistorial.create({
        data: {
          idTarea,
          idUsuario: idActor,
          accion: "reasignada",
          valorAnterior: String(tarea.idAsignado),
          valorNuevo: null,
        },
      });
    }
    return { tarea: { ...tarea, idAsignado }, accion, motivoValidado, asignadoPuedeRecibir };
  });

  const asignado = tarea.idAsignado;
  if (nuevoEstado === "completada" && asignado === idActor) {
    // El lider aprobo su propia entrega: se avisa al resto del grupo, solo dentro de la app.
    await notificarAutoaprobacion(idGrupo, idTarea, tarea.titulo, idActor);
    return;
  }
  // Quien ya salió del grupo (dejó la tarea en revisión) no recibe avisos.
  if (!asignado || asignado === idActor || !asignadoPuedeRecibir) return;
  if (accion === "devolver") {
    await crearNotificacion({
      idUsuario: asignado,
      tipo: "tarea_devuelta",
      idGrupo,
      ...plantillasNotificacion.tareaDevuelta(tarea.titulo, idGrupo, idTarea, motivoValidado),
    });
  } else if (accion === "reabrir") {
    await crearNotificacion({
      idUsuario: asignado,
      tipo: "tarea_reabierta",
      idGrupo,
      ...plantillasNotificacion.tareaReabierta(tarea.titulo, idGrupo, idTarea, motivoValidado),
    });
  } else if (accion === "descartar") {
    await crearNotificacion({
      idUsuario: asignado,
      tipo: "tarea_descartada",
      idGrupo,
      ...plantillasNotificacion.tareaDescartada(tarea.titulo, idGrupo, idTarea, motivoValidado),
    });
  } else if (nuevoEstado === "completada") {
    await crearNotificacion({
      idUsuario: asignado,
      tipo: "tarea_completada",
      idGrupo,
      ...plantillasNotificacion.tareaCompletada(tarea.titulo, idGrupo, idTarea),
    });
  }
}
