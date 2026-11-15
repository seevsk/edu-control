import { prisma } from "@/server/db/client";

export async function listarNotificaciones(idUsuario: number, limite = 30) {
  return prisma.notificacion.findMany({
    where: { idUsuario },
    orderBy: { fechaCreacion: "desc" },
    take: limite,
  });
}

export async function contarNotificacionesNoLeidas(idUsuario: number) {
  return prisma.notificacion.count({ where: { idUsuario, leida: false } });
}

export async function marcarNotificacionLeida(idUsuario: number, idNotificacion: number) {
  await prisma.notificacion.updateMany({
    where: { idNotificacion, idUsuario },
    data: { leida: true },
  });
}

export async function marcarTodasLeidas(idUsuario: number) {
  await prisma.notificacion.updateMany({
    where: { idUsuario, leida: false },
    data: { leida: true },
  });
}

const LIMITE_BANDEJA = 80;
const PATRON_ENLACE = /^\/grupos\/(\d+)(?:\/tareas\/(\d+))?/;

/**
 * Bandeja: notificaciones con su contexto (grupo, curso y tarea) sacado del enlace que generó el
 * servidor, sin columnas nuevas. Las de una misma tarea se apilan en un solo elemento.
 */
export async function obtenerBandeja(idUsuario: number) {
  const notificaciones = await prisma.notificacion.findMany({
    where: { idUsuario },
    orderBy: { fechaCreacion: "desc" },
    take: LIMITE_BANDEJA,
  });
  const enlaces = notificaciones.map((notificacion) => notificacion.enlace?.match(PATRON_ENLACE) ?? null);
  const idsGrupo = [...new Set(enlaces.flatMap((coincidencia) => (coincidencia ? [Number(coincidencia[1])] : [])))];
  const [grupos, pendientes] = await Promise.all([
    prisma.grupo.findMany({
      // Solo grupos donde participa: un enlace no es permiso.
      where: { idGrupo: { in: idsGrupo }, integrantes: { some: { idUsuario, estadoInvitacion: "aceptada" } } },
      select: { idGrupo: true, nombre: true, evaluacion: { select: { curso: { select: { idCurso: true, nombre: true } } } } },
    }),
    prisma.grupoIntegrante.findMany({
      where: { idUsuario, estadoInvitacion: "pendiente" },
      select: { idGrupo: true, fechaInvitacion: true, grupo: { select: { nombre: true, estado: true, evaluacion: { select: { curso: { select: { idCurso: true, nombre: true } } } } } } },
    }),
  ]);
  const grupoPorId = new Map(grupos.map((grupo) => [grupo.idGrupo, grupo]));

  type Elemento = {
    clave: string;
    ids: number[];
    tipo: (typeof notificaciones)[number]["tipo"];
    mensaje: string;
    enlace: string | null;
    fecha: Date;
    leida: boolean;
    cantidad: number;
    idGrupo: number | null;
    idTarea: number | null;
    grupo: { nombre: string; curso: { idCurso: number; nombre: string } | null } | null;
  };
  const elementos: Elemento[] = [];
  const porTarea = new Map<number, Elemento>();
  notificaciones.forEach((notificacion, indice) => {
    const coincidencia = enlaces[indice];
    const idGrupo = coincidencia ? Number(coincidencia[1]) : null;
    const idTarea = coincidencia?.[2] ? Number(coincidencia[2]) : null;
    const grupo = idGrupo ? grupoPorId.get(idGrupo) : undefined;
    if (idTarea && porTarea.has(idTarea)) {
      const existente = porTarea.get(idTarea)!;
      existente.ids.push(notificacion.idNotificacion);
      existente.cantidad++;
      existente.leida = existente.leida && notificacion.leida;
      return;
    }
    const elemento: Elemento = {
      clave: idTarea ? `tarea-${idTarea}` : `n-${notificacion.idNotificacion}`,
      ids: [notificacion.idNotificacion],
      tipo: notificacion.tipo,
      mensaje: notificacion.mensaje,
      enlace: notificacion.enlace,
      fecha: notificacion.fechaCreacion,
      leida: notificacion.leida,
      cantidad: 1,
      idGrupo: grupo ? idGrupo : null,
      idTarea: grupo ? idTarea : null,
      grupo: grupo ? { nombre: grupo.nombre, curso: grupo.evaluacion?.curso ?? null } : null,
    };
    if (elemento.idTarea) porTarea.set(elemento.idTarea, elemento);
    elementos.push(elemento);
  });

  return {
    elementos,
    invitacionesPendientes: pendientes.map((pendiente) => ({
      idGrupo: pendiente.idGrupo,
      fecha: pendiente.fechaInvitacion,
      nombre: pendiente.grupo.nombre,
      finalizado: pendiente.grupo.estado === "finalizado",
      curso: pendiente.grupo.evaluacion?.curso ?? null,
    })),
  };
}

export async function marcarVariasLeidas(idUsuario: number, ids: number[]) {
  if (!ids.length) return;
  await prisma.notificacion.updateMany({ where: { idUsuario, idNotificacion: { in: ids }, leida: false }, data: { leida: true } });
}
