import { prisma } from "@/server/db/client";
import { puedeReabrirse } from "@/lib/estado-reunion";

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
const PATRON_GRUPO = /^\/grupos\/(\d+)(?:\/tareas\/(\d+))?/;
const PATRON_REUNION = /^\/reuniones\?grupo=(\d+)(?:&reunion=(\d+))?/;
/** Enlace actual de una reunión: `/reuniones/12` (el grupo se resuelve en la consulta). */
const PATRON_REUNION_ID = /^\/reuniones\/(\d+)\/?$/;
const PATRON_INVITACION = /[?&]sel=inv-(\d+)/;
const PATRON_EVALUACION = /^\/cursos\/(\d+)\?evaluacion=(\d+)/;

const PERSONA = { idUsuario: true, nombre: true, apellidos: true, fotoUrl: true } as const;
const GRUPO_INVITACION = {
  idGrupo: true,
  nombre: true,
  estado: true,
  evaluacion: { select: { nombre: true, curso: { select: { idCurso: true, nombre: true } } } },
} as const;

type Destino = {
  idGrupo?: number;
  idTarea?: number | null;
  idReunion?: number | null;
  idInvitacion?: number;
  idCurso?: number;
  idEvaluacion?: number;
};

/** A qué apunta el enlace que generó el servidor (nunca se usa como permiso). */
function leerEnlace(enlace: string | null): Destino {
  if (!enlace) return {};
  const grupo = enlace.match(PATRON_GRUPO);
  if (grupo) return { idGrupo: Number(grupo[1]), idTarea: grupo[2] ? Number(grupo[2]) : null };
  const reunion = enlace.match(PATRON_REUNION);
  if (reunion) return { idGrupo: Number(reunion[1]), idReunion: reunion[2] ? Number(reunion[2]) : null };
  const reunionId = enlace.match(PATRON_REUNION_ID);
  if (reunionId) return { idReunion: Number(reunionId[1]) };
  const invitacion = enlace.match(PATRON_INVITACION);
  if (invitacion) return { idInvitacion: Number(invitacion[1]) };
  const evaluacion = enlace.match(PATRON_EVALUACION);
  if (evaluacion) return { idCurso: Number(evaluacion[1]), idEvaluacion: Number(evaluacion[2]) };
  return {};
}

/**
 * Bandeja: notificaciones con su contexto (grupo, curso, tarea, reunión, evaluación) sacado del
 * enlace que generó el servidor, sin columnas nuevas. Las de una misma tarea se apilan en un solo
 * elemento. Absorbe el antiguo módulo Invitaciones: pendientes por responder e historial.
 */
export async function obtenerBandeja(idUsuario: number) {
  const [notificaciones, pendientes, historial] = await Promise.all([
    prisma.notificacion.findMany({
      where: { idUsuario },
      orderBy: { fechaCreacion: "desc" },
      take: LIMITE_BANDEJA,
    }),
    prisma.grupoIntegrante.findMany({
      where: { idUsuario, estadoInvitacion: "pendiente" },
      select: {
        idGrupo: true,
        fechaInvitacion: true,
        invitador: { select: PERSONA },
        grupo: { select: { ...GRUPO_INVITACION, creador: { select: PERSONA } } },
      },
      orderBy: { fechaInvitacion: "desc" },
    }),
    // Invitaciones respondidas y salidas. No incluye los grupos que creó (salvo su propia salida) ni las
    // invitaciones canceladas antes de responderlas.
    prisma.grupoIntegrante.findMany({
      where: {
        idUsuario,
        estadoInvitacion: { notIn: ["pendiente", "cancelada"] },
        OR: [{ grupo: { idCreador: { not: idUsuario } } }, { estadoInvitacion: "retirado" }],
      },
      select: {
        idGrupo: true,
        estadoInvitacion: true,
        retiroVoluntario: true,
        fechaInvitacion: true,
        fechaRespuesta: true,
        fechaRetiro: true,
        invitador: { select: PERSONA },
        grupo: { select: GRUPO_INVITACION },
      },
      orderBy: [{ fechaRetiro: { sort: "desc", nulls: "last" } }, { fechaRespuesta: "desc" }],
    }),
  ]);
  const enlaces = notificaciones.map((notificacion) => leerEnlace(notificacion.enlace));
  // Los enlaces `/reuniones/{id}` no traen el grupo: se obtiene de la reunión (el acceso se comprueba abajo).
  const idsReunionSinGrupo = enlaces.flatMap((destino) => (destino.idReunion && !destino.idGrupo ? [destino.idReunion] : []));
  if (idsReunionSinGrupo.length > 0) {
    const reunionesDelEnlace = await prisma.reunion.findMany({
      where: { idReunion: { in: idsReunionSinGrupo } },
      select: { idReunion: true, idGrupo: true },
    });
    const grupoPorReunion = new Map(reunionesDelEnlace.map((reunion) => [reunion.idReunion, reunion.idGrupo]));
    for (const destino of enlaces) {
      if (destino.idReunion && !destino.idGrupo) destino.idGrupo = grupoPorReunion.get(destino.idReunion);
    }
  }
  const idsGrupo = [...new Set(enlaces.flatMap((destino) => (destino.idGrupo ? [destino.idGrupo] : [])))];
  const grupos = await prisma.grupo.findMany({
    // Solo grupos donde participa: un enlace no es permiso.
    where: { idGrupo: { in: idsGrupo }, integrantes: { some: { idUsuario, estadoInvitacion: "aceptada" } } },
    select: { idGrupo: true, nombre: true, evaluacion: { select: { curso: { select: { idCurso: true, nombre: true } } } } },
  });
  const grupoPorId = new Map(grupos.map((grupo) => [grupo.idGrupo, grupo]));
  const idPendientes = new Set(pendientes.map((pendiente) => pendiente.idGrupo));
  // Los avisos antiguos de invitación no guardaban el id del grupo: se reconoce por su nombre.
  const idGrupoPorNombre = new Map([...pendientes, ...historial].map((registro) => [registro.grupo.nombre, registro.idGrupo]));

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
    idReunion: number | null;
    idInvitacion: number | null;
    idEvaluacion: number | null;
    idCurso: number | null;
    grupo: { nombre: string; curso: { idCurso: number; nombre: string } | null } | null;
  };
  const elementos: Elemento[] = [];
  const avisosDeInvitacion = new Map<number, { ids: number[]; leida: boolean }>();
  const porTarea = new Map<number, Elemento>();
  notificaciones.forEach((notificacion, indice) => {
    const destino = enlaces[indice];
    const grupo = destino.idGrupo ? grupoPorId.get(destino.idGrupo) : undefined;
    const idTarea = grupo && destino.idTarea ? destino.idTarea : null;
    let idInvitacion = destino.idInvitacion ?? null;
    if (notificacion.tipo === "invitacion_grupo" && !idInvitacion) {
      const nombre = notificacion.mensaje.match(/(?:te invitó a|Te invitaron a) (.+)$/)?.[1];
      idInvitacion = nombre ? idGrupoPorNombre.get(nombre) ?? null : null;
    }
    // Las invitaciones aún por responder ya se muestran arriba, con sus botones.
    if (notificacion.tipo === "invitacion_grupo" && idInvitacion && idPendientes.has(idInvitacion)) {
      const avisos = avisosDeInvitacion.get(idInvitacion) ?? { ids: [], leida: true };
      avisos.ids.push(notificacion.idNotificacion);
      avisos.leida &&= notificacion.leida;
      avisosDeInvitacion.set(idInvitacion, avisos);
      return;
    }

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
      idGrupo: grupo ? destino.idGrupo! : null,
      idTarea,
      idReunion: grupo ? destino.idReunion ?? null : null,
      idInvitacion,
      idEvaluacion: destino.idEvaluacion ?? null,
      idCurso: destino.idCurso ?? null,
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
      invitador: pendiente.invitador ?? pendiente.grupo.creador,
      // Avisos de esta invitación: se marcan leídos al abrirla.
      idsAviso: avisosDeInvitacion.get(pendiente.idGrupo)?.ids ?? [],
      avisoLeido: avisosDeInvitacion.get(pendiente.idGrupo)?.leida ?? true,
    })),
    historialInvitaciones: historial.map((registro) => ({
      idGrupo: registro.idGrupo,
      estado: registro.estadoInvitacion,
      voluntario: registro.retiroVoluntario,
      fecha: (registro.estadoInvitacion === "retirado" ? registro.fechaRetiro : registro.fechaRespuesta) ?? registro.fechaInvitacion,
      nombre: registro.grupo.nombre,
      curso: registro.grupo.evaluacion?.curso ?? null,
      invitador: registro.invitador,
    })),
  };
}

export async function marcarVariasLeidas(idUsuario: number, ids: number[]) {
  if (!ids.length) return;
  await prisma.notificacion.updateMany({ where: { idUsuario, idNotificacion: { in: ids }, leida: false }, data: { leida: true } });
}

/**
 * Invitación propia (pendiente o del historial) con lo necesario para decidir: quién invita, a
 * qué grupo y curso, la fecha límite y quién lo lidera. Los nombres del resto del grupo solo se
 * muestran después de aceptar.
 */
export async function obtenerDetalleInvitacion(idUsuario: number, idGrupo: number) {
  const registro = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    select: {
      estadoInvitacion: true,
      retiroVoluntario: true,
      fechaInvitacion: true,
      fechaRespuesta: true,
      fechaRetiro: true,
      invitador: { select: PERSONA },
      grupo: {
        select: {
          ...GRUPO_INVITACION,
          descripcion: true,
          fechaLimite: true,
          creador: { select: PERSONA },
          integrantes: { where: { estadoInvitacion: "aceptada" }, select: { rol: true, usuario: { select: PERSONA } } },
        },
      },
    },
  });
  // Una invitación cancelada nunca llegó a ser del invitado: no se le muestra nada del grupo.
  if (!registro || registro.estadoInvitacion === "cancelada") return null;
  const aceptado = registro.estadoInvitacion === "aceptada";
  return {
    ...registro,
    invitador: registro.invitador ?? registro.grupo.creador,
    lider: registro.grupo.integrantes.find((integrante) => integrante.rol === "lider")?.usuario ?? null,
    cantidadIntegrantes: registro.grupo.integrantes.length,
    integrantes: aceptado ? registro.grupo.integrantes.map((integrante) => integrante.usuario) : [],
  };
}

/** Reunión de un grupo donde el usuario es integrante. Sin id (avisos antiguos) se busca por título y fecha del aviso. */
export async function obtenerReunionParaBandeja(idUsuario: number, idGrupo: number, idReunion: number | null, titulo: string | null, fechaAviso: Date) {
  const miembro = await prisma.grupoIntegrante.findFirst({ where: { idGrupo, idUsuario, estadoInvitacion: "aceptada" }, select: { idUsuario: true } });
  if (!miembro) return null;
  const margen = 5 * 60_000;
  const reunion = await prisma.reunion.findFirst({
    where: idReunion
      ? { idReunion, idGrupo }
      : {
          idGrupo,
          ...(titulo ? { titulo } : {}),
          fechaCreacion: { gte: new Date(fechaAviso.getTime() - margen), lte: new Date(fechaAviso.getTime() + margen) },
        },
    include: {
      grupo: { select: { estado: true } },
      creador: { select: PERSONA },
      finalizador: { select: PERSONA },
      asistentes: { select: { idUsuario: true, respuesta: true, fechaEntrada: true, usuario: { select: PERSONA } } },
    },
  });
  if (!reunion) return null;
  // Cerrada sola por sala vacia y dentro de la ventana: el panel ofrece Unirse en vez de "terminó".
  const vigentes = await prisma.grupoIntegrante.findMany({
    where: { idGrupo, estadoInvitacion: "aceptada", rol: { not: "observador" } },
    select: { idUsuario: true },
  });
  const ids = new Set(vigentes.map((v) => v.idUsuario));
  return {
    ...reunion,
    asistentes: reunion.asistentes.filter((a) => ids.has(a.idUsuario)),
    reabrible: reunion.grupo.estado === "activo" && puedeReabrirse(reunion, new Date()),
  };
}
