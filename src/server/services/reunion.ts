import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db/client";
import { ErrorDeNegocio } from "@/lib/errores";
import { etiquetaFechaLarga, etiquetaMinutos } from "@/lib/calendario";
import { duracionMinutos, hora } from "@/lib/formato-fecha";
import {
  APERTURA_MIN,
  CIERRE_MIN,
  GRACIA_SALA_VACIA_MIN,
  accionSalaVacia,
  comoVigente,
  estadoReunion,
  intervaloOcupado,
  puedeReabrirse,
  rangoReunirseAhora,
  salaAbierta,
  ventanaSala,
} from "@/lib/estado-reunion";
import { crearNotificacion } from "@/server/notifications/crear-notificacion";
import { plantillasNotificacion } from "@/server/notifications/templates";
import { proveedorVideo, type CredencialesSala } from "@/server/video";
import type { crearReunionSchema } from "@/lib/validation/reunion";
import type { Prisma } from "../../../generated/prisma/client";
import type { z } from "zod";

const MS_MIN = 60_000;

/** Integrante aceptado y no observador: puede programar reuniones y confirmar asistencia. */
async function requerirParticipante(idUsuario: number, idGrupo: number) {
  const integrante = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    include: { grupo: true },
  });
  if (!integrante || integrante.estadoInvitacion !== "aceptada") throw new ErrorDeNegocio("Grupo no encontrado");
  if (integrante.rol === "observador") throw new ErrorDeNegocio("Los observadores no participan en reuniones");
  return integrante;
}

/** Integrante aceptado de un grupo (observadores incluidos) o `null`. */
async function integranteAceptado(idUsuario: number, idGrupo: number) {
  const integrante = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    select: { rol: true, estadoInvitacion: true },
  });
  return integrante && integrante.estadoInvitacion === "aceptada" ? integrante : null;
}

/** Lider o quien creo la reunion: puede finalizarla para todos. */
function esModerador(reunion: { idCreador: number }, integrante: { rol: string; idUsuario: number }) {
  return integrante.rol === "lider" || reunion.idCreador === integrante.idUsuario;
}

function nombreSala(idReunion: number) {
  return `ec-${idReunion}-${randomBytes(4).toString("hex")}`;
}

/** Integrantes aceptados no observadores: los que asisten y reciben avisos. */
function participantesDe(idGrupo: number, db: Pick<Prisma.TransactionClient, "grupoIntegrante"> = prisma) {
  return db.grupoIntegrante.findMany({
    where: { idGrupo, estadoInvitacion: "aceptada", rol: { not: "observador" } },
    select: { idUsuario: true },
  });
}

/** Deja en cada reunion solo los asistentes que siguen aceptados y no son observadores en su grupo. */
async function soloParticipantes<T extends { idGrupo: number; asistentes: { idUsuario: number }[] }>(reuniones: T[]): Promise<T[]> {
  if (reuniones.length === 0) return reuniones;
  const vigentes = await prisma.grupoIntegrante.findMany({
    where: { idGrupo: { in: [...new Set(reuniones.map((r) => r.idGrupo))] }, estadoInvitacion: "aceptada", rol: { not: "observador" } },
    select: { idGrupo: true, idUsuario: true },
  });
  const claves = new Set(vigentes.map((v) => `${v.idGrupo}:${v.idUsuario}`));
  return reuniones.map((r) => ({ ...r, asistentes: r.asistentes.filter((a) => claves.has(`${r.idGrupo}:${a.idUsuario}`)) }));
}

function nombreDe(usuario: { nombre: string; apellidos: string | null }) {
  return [usuario.nombre, usuario.apellidos].filter(Boolean).join(" ");
}

/** Quita la URL de la sala: nunca sale del servidor fuera de la pagina de sala. */
function sinSala<T extends { salaUrl: string | null }>(reunion: T) {
  const { salaUrl, ...resto } = reunion;
  return { ...resto, tieneSala: salaUrl !== null };
}

type Asistentes = { idUsuario: number }[];

function asistentesIniciales(participantes: Asistentes, idCreador: number) {
  return {
    create: participantes.map((p) => ({
      idUsuario: p.idUsuario,
      // Quien la programa asiste: no tiene sentido pedirle que confirme.
      respuesta: p.idUsuario === idCreador ? ("asistire" as const) : ("pendiente" as const),
      fechaRespuesta: p.idUsuario === idCreador ? new Date() : null,
    })),
  };
}

/**
 * Crea la reunion con videollamada dentro de una transaccion: reunion y asistentes, sala en el
 * proveedor y URL guardada. Si la sala falla, la transaccion se revierte sola; si la transaccion
 * falla despues de crear la sala, se borra la sala y se relanza el error.
 */
async function transaccionConSala<T>(
  crear: (tx: Prisma.TransactionClient, registrarSala: (url: string) => void) => Promise<T>,
): Promise<T> {
  let salaCreada = null as string | null;
  try {
    return await prisma.$transaction((tx) => crear(tx, (url) => (salaCreada = url)), { timeout: 15000 });
  } catch (error) {
    if (salaCreada) {
      try {
        await proveedorVideo.borrarSala(salaCreada);
      } catch {
        console.error("[video] No se pudo borrar la sala tras un error; vencera sola");
      }
    }
    throw error;
  }
}

async function crearSalaDeReunion(
  tx: Prisma.TransactionClient,
  reunion: { idReunion: number; inicio: Date; fin: Date },
  registrarSala: (url: string) => void,
) {
  const { apertura, cierre } = ventanaSala(reunion.inicio, reunion.fin);
  const sala = await proveedorVideo.crearSala({ nombre: nombreSala(reunion.idReunion), abre: apertura, cierra: cierre });
  registrarSala(sala);
  await tx.reunion.update({ where: { idReunion: reunion.idReunion }, data: { salaUrl: sala } });
}

/**
 * Reuniones de todos mis grupos (donde estoy aceptado, observadores incluidos: las ven pero no
 * responden), con la asistencia y mi rol en cada grupo. `enCurso` = sala abierta, `proximas` =
 * aun no abre, `pasadas` = terminadas.
 */
export async function listarMisReuniones(idUsuario: number) {
  const membresias = await prisma.grupoIntegrante.findMany({
    where: { idUsuario, estadoInvitacion: "aceptada" },
    select: { idGrupo: true, rol: true },
  });
  const rolPorGrupo = new Map(membresias.map((m) => [m.idGrupo, m.rol]));
  const idsGrupo = [...rolPorGrupo.keys()];

  await cerrarReunionesVencidas(idsGrupo);

  const ahora = new Date();
  const incluir = {
    grupo: { select: { nombre: true, estado: true, evaluacion: { select: { idCurso: true } } } },
    creador: { select: { idUsuario: true, nombre: true } },
    finalizador: { select: { idUsuario: true, nombre: true } },
    asistentes: {
      select: {
        idUsuario: true,
        respuesta: true,
        fechaEntrada: true,
        usuario: { select: { nombre: true, apellidos: true, fotoUrl: true } },
      },
    },
  } as const;

  // Las que aun pueden tener la sala abierta (hasta 15 min despues de su fin) y las ya pasadas.
  const [vigentes, recientes] = await Promise.all([
    prisma.reunion.findMany({
      where: { idGrupo: { in: idsGrupo }, fin: { gte: new Date(ahora.getTime() - CIERRE_MIN * MS_MIN) } },
      include: incluir,
      orderBy: { inicio: "asc" },
    }),
    prisma.reunion.findMany({
      where: { idGrupo: { in: idsGrupo }, fin: { lt: ahora } },
      include: incluir,
      orderBy: { inicio: "desc" },
      take: 8,
    }),
  ]);

  const porId = new Map([...vigentes, ...recientes].map((r) => [r.idReunion, r]));
  const filtradas = await soloParticipantes([...porId.values()]);
  const todas = filtradas.map((original) => {
    const reunion = comoVigente(original, ahora, original.grupo.estado === "activo");
    return { ...sinSala(reunion), estado: estadoReunion(reunion, ahora) };
  });

  const proximas = todas.filter((r) => r.estado === "programada").sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const enCurso = todas.filter((r) => salaAbierta(r.estado)).sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const pasadas = todas
    .filter((r) => r.estado === "terminada")
    .sort((a, b) => b.inicio.getTime() - a.inicio.getTime())
    .slice(0, 8);

  return { proximas, enCurso, pasadas, rolPorGrupo };
}

/** Grupos activos donde puedo programar (aceptado, no observador). */
export async function gruposParaProgramar(idUsuario: number) {
  return prisma.grupo.findMany({
    where: {
      estado: "activo",
      integrantes: { some: { idUsuario, estadoInvitacion: "aceptada", rol: { not: "observador" } } },
    },
    select: {
      idGrupo: true,
      nombre: true,
      evaluacion: { select: { curso: { select: { idCurso: true, nombre: true } } } },
    },
    orderBy: { fechaCreacion: "desc" },
  });
}

export async function crearReunion(idUsuario: number, idGrupo: number, datos: z.infer<typeof crearReunionSchema>) {
  const { grupo } = await requerirParticipante(idUsuario, idGrupo);
  if (grupo.estado !== "activo") throw new ErrorDeNegocio("El grupo está finalizado");

  const inicio = new Date(`${datos.fecha}T${datos.horaInicio}:00-05:00`);
  const fin = new Date(`${datos.fecha}T${datos.horaFin}:00-05:00`);
  if (inicio <= new Date()) throw new ErrorDeNegocio("La reunión debe empezar en el futuro: elige una fecha y hora posteriores");

  const participantes = await participantesDe(idGrupo);

  const datosReunion = {
    idGrupo,
    idCreador: idUsuario,
    titulo: datos.titulo,
    inicio,
    fin,
    lugar: datos.lugar || null,
  };

  let reunion;
  if (datos.videollamada) {
    reunion = await transaccionConSala(async (tx, registrarSala) => {
      // El create anidado inserta reunion y asistentes de forma atomica.
      const creada = await tx.reunion.create({
        data: {
          ...datosReunion,
          enlace: null,
          videollamada: true,
          asistentes: asistentesIniciales(participantes, idUsuario),
        },
      });
      await crearSalaDeReunion(tx, creada, registrarSala);
      return creada;
    });
  } else {
    reunion = await prisma.reunion.create({
      data: {
        ...datosReunion,
        enlace: datos.enlace || null,
        asistentes: asistentesIniciales(participantes, idUsuario),
      },
    });
  }

  const cuando = `${etiquetaFechaLarga(datos.fecha).toLowerCase()}, ${etiquetaMinutos(
    Number(datos.horaInicio.slice(0, 2)) * 60 + Number(datos.horaInicio.slice(3)),
  )}`;
  for (const participante of participantes) {
    if (participante.idUsuario === idUsuario) continue;
    await crearNotificacion({
      idUsuario: participante.idUsuario,
      tipo: "reunion_programada",
      idGrupo,
      ...plantillasNotificacion.reunionProgramada(datos.titulo, grupo.nombre, idGrupo, reunion.idReunion, cuando),
    });
  }

  return reunion;
}

/**
 * "Reunirse ahora": empieza ya y dura 1 h. Solo una reunion activa por grupo: si ya hay una con
 * la sala abierta, se devuelve esa. No envia `reunion_programada`: el aviso sera `reunion_iniciada`.
 */
export async function reunirseAhora(
  idUsuario: number,
  idGrupo: number,
): Promise<{ idReunion: number; yaExistia: boolean; iniciador: string | null }> {
  const { grupo } = await requerirParticipante(idUsuario, idGrupo);
  if (grupo.estado !== "activo") throw new ErrorDeNegocio("El grupo está finalizado");

  const participantes = await participantesDe(idGrupo);

  // Si la reunion anterior quedo abandonada (sala vacia), se cierra y se crea una nueva.
  await cerrarSalasVacias([idGrupo]);

  return transaccionConSala(async (tx, registrarSala) => {
    // Serializa por grupo: dos clics simultaneos no crean dos reuniones.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4247, ${idGrupo})`;

    const ahora = new Date();
    // Incluye las cerradas solas por sala vacia que aun se pueden reabrir: se entra a esa, no se crea otra.
    const candidatas = await tx.reunion.findMany({
      where: {
        idGrupo,
        videollamada: true,
        inicio: { lte: new Date(ahora.getTime() + APERTURA_MIN * MS_MIN) },
        fin: { gt: new Date(ahora.getTime() - CIERRE_MIN * MS_MIN) },
      },
      include: {
        creador: { select: { nombre: true, apellidos: true } },
        asistentes: {
          where: { fechaEntrada: { not: null } },
          orderBy: { fechaEntrada: "asc" },
          take: 1,
          select: { usuario: { select: { nombre: true, apellidos: true } } },
        },
      },
      orderBy: { inicio: "desc" },
    });
    const existente = candidatas.find((r) => !r.finalizadaEn || puedeReabrirse(r, ahora));
    if (existente) {
      const quien = existente.asistentes[0]?.usuario ?? existente.creador;
      return { idReunion: existente.idReunion, yaExistia: true, iniciador: nombreDe(quien) };
    }

    // 1 h, recortada a 23:59 (Lima) para no cruzar la medianoche.
    const { inicio, fin } = rangoReunirseAhora(ahora);
    const creada = await tx.reunion.create({
      data: {
        idGrupo,
        idCreador: idUsuario,
        titulo: `Reunión de ${grupo.nombre}`.slice(0, 120),
        inicio,
        fin,
        videollamada: true,
        asistentes: asistentesIniciales(participantes, idUsuario),
      },
    });
    await crearSalaDeReunion(tx, creada, registrarSala);
    return { idReunion: creada.idReunion, yaExistia: false, iniciador: null };
  });
}

/** Avisa a los participantes (menos `excluir`) con la plantilla de reunion indicada. */
async function avisarParticipantes(
  idGrupo: number,
  excluir: number | null,
  crear: (idUsuario: number) => Parameters<typeof crearNotificacion>[0],
) {
  const participantes = await participantesDe(idGrupo);
  for (const participante of participantes) {
    if (participante.idUsuario === excluir) continue;
    await crearNotificacion(crear(participante.idUsuario));
  }
}

/**
 * Registra que alguien pulso Unirse: guarda su primera entrada y, si es la primera de la reunion,
 * la marca como iniciada y avisa al resto. Devuelve el grupo para revalidar.
 */
export async function registrarEntrada(idUsuario: number, idReunion: number) {
  const reunion = await prisma.reunion.findUnique({ where: { idReunion }, include: { grupo: { select: { nombre: true, estado: true } } } });
  if (!reunion) throw new ErrorDeNegocio("Esa reunión ya no existe");
  await requerirParticipante(idUsuario, reunion.idGrupo);
  if (!reunion.videollamada) throw new ErrorDeNegocio("Esta reunión no tiene videollamada");
  // Un grupo finalizado es de solo lectura: no se entrega token.
  if (reunion.grupo.estado !== "activo") throw new ErrorDeNegocio("El grupo está finalizado");

  const entrada = new Date();
  // Cerrada sola por sala vacia y aun dentro de la ventana: se reabre (como Meet o Zoom).
  let reabierta = false;
  if (puedeReabrirse(reunion, entrada)) {
    const { apertura, cierre } = ventanaSala(reunion.inicio, reunion.fin);
    const sala = await proveedorVideo.crearSala({ nombre: reunion.salaUrl ?? nombreSala(idReunion), abre: apertura, cierra: cierre });
    const { count } = await prisma.reunion.updateMany({
      // Condicion atomica: solo una llamada la reabre; si un moderador la finalizo entre tanto, no.
      where: { idReunion, finalizadaEn: reunion.finalizadaEn, idFinalizador: null },
      data: { finalizadaEn: null, salaUrl: sala, iniciadaEn: entrada },
    });
    reabierta = count === 1;
  } else if (!salaAbierta(estadoReunion(reunion, entrada))) {
    throw new ErrorDeNegocio("La sala no está abierta");
  }

  // Primero se asegura la fila (sin tocar fechaEntrada) y luego se fija solo si aun es null.
  await prisma.reunionAsistente.upsert({
    where: { idReunion_idUsuario: { idReunion, idUsuario } },
    create: { idReunion, idUsuario, respuesta: "pendiente" },
    update: {},
  });
  await prisma.reunionAsistente.updateMany({
    where: { idReunion, idUsuario, fechaEntrada: null },
    data: { fechaEntrada: entrada },
  });

  // Marca atomica del inicio: solo una llamada ve count === 1 aunque entren a la vez.
  const { count } = await prisma.reunion.updateMany({
    where: { idReunion, iniciadaEn: null },
    data: { iniciadaEn: entrada },
  });
  // Criterio idempotente: tras reabrir se avisa siempre (hubo un "terminó" en medio); si no, solo
  // cuando nunca se envio un aviso de inicio para esta reunion (iniciadaEn pudo limpiarse antes de la hora).
  const yaAvisada =
    !reabierta && count === 1
      ? (await prisma.notificacion.count({ where: { tipo: "reunion_iniciada", enlace: `/reuniones/${idReunion}` } })) > 0
      : false;
  if ((reabierta || count === 1) && !yaAvisada) {
    const persona = await prisma.usuario.findUnique({
      where: { idUsuario },
      select: { nombre: true, apellidos: true },
    });
    const nombre = persona ? nombreDe(persona) : "Alguien";
    await avisarParticipantes(reunion.idGrupo, idUsuario, (destinatario) => ({
      idUsuario: destinatario,
      tipo: "reunion_iniciada",
      idGrupo: reunion.idGrupo,
      ...plantillasNotificacion.reunionIniciada(nombre, reunion.titulo, reunion.grupo.nombre, idReunion, hora(reunion.inicio), hora(reunion.fin)),
    }));
  }
  return reunion.idGrupo;
}

export type DatosDeSala =
  | { tipo: "cerrada"; estado: ReturnType<typeof estadoReunion> }
  | { tipo: "requiere_unirse"; idReunion: number }
  | {
      tipo: "lista";
      estado: ReturnType<typeof estadoReunion>;
      credenciales: CredencialesSala;
      cierre: Date;
      moderador: boolean;
      titulo: string;
      grupo: string;
      idGrupo: number;
    };

/**
 * Datos de la pagina de sala. `null` si no existe, no hay videollamada o quien pregunta no es
 * participante (observadores incluidos): para ellos la sala responde 404.
 */
export async function datosDeSala(idUsuario: number, idReunion: number): Promise<DatosDeSala | null> {
  const reunion = await prisma.reunion.findUnique({
    where: { idReunion },
    include: {
      grupo: { select: { nombre: true, estado: true } },
      asistentes: { where: { idUsuario }, select: { fechaEntrada: true } },
    },
  });
  if (!reunion || !reunion.videollamada || !reunion.salaUrl) return null;

  const integrante = await integranteAceptado(idUsuario, reunion.idGrupo);
  if (!integrante || integrante.rol === "observador") return null;

  const estado = estadoReunion(reunion, new Date());
  if (!salaAbierta(estado) || reunion.grupo.estado !== "activo") return { tipo: "cerrada", estado };
  if (!reunion.asistentes[0]?.fechaEntrada) return { tipo: "requiere_unirse", idReunion };

  const usuario = await prisma.usuario.findUnique({ where: { idUsuario }, select: { nombre: true, apellidos: true } });
  const { apertura, cierre } = ventanaSala(reunion.inicio, reunion.fin);
  const moderador = esModerador(reunion, { rol: integrante.rol, idUsuario });
  const credenciales = await proveedorVideo.credencialesDeEntrada({
    sala: reunion.salaUrl,
    idUsuario,
    nombre: usuario ? nombreDe(usuario) : "Participante",
    moderador,
    abre: apertura,
    cierra: cierre,
  });
  return { tipo: "lista", estado, credenciales, cierre, moderador, titulo: reunion.titulo, grupo: reunion.grupo.nombre, idGrupo: reunion.idGrupo };
}

/** Marca la reunion como finalizada y avisa; devuelve `true` si esta llamada fue la que la cerro. */
async function marcarFinalizada(
  reunion: { idReunion: number; idGrupo: number; titulo: string; iniciadaEn: Date | null; grupo: { nombre: string } },
  finalizadaEn: Date,
  idFinalizador: number | null,
) {
  const { count } = await prisma.reunion.updateMany({
    where: { idReunion: reunion.idReunion, finalizadaEn: null },
    data: { finalizadaEn, idFinalizador },
  });
  if (count !== 1) return false;

  if (reunion.iniciadaEn) {
    const participantes = (await participantesDe(reunion.idGrupo)).map((p) => p.idUsuario);
    const entraron = await prisma.reunionAsistente.count({
      where: { idReunion: reunion.idReunion, fechaEntrada: { not: null }, idUsuario: { in: participantes } },
    });
    const minutos = Math.max(1, Math.round((finalizadaEn.getTime() - reunion.iniciadaEn.getTime()) / MS_MIN));
    let finalizador: string | null = null;
    if (idFinalizador !== null) {
      const usuario = await prisma.usuario.findUnique({
        where: { idUsuario: idFinalizador },
        select: { nombre: true, apellidos: true },
      });
      finalizador = usuario ? nombreDe(usuario) : null;
    }
    await avisarParticipantes(reunion.idGrupo, idFinalizador, (idUsuario) => ({
      idUsuario,
      tipo: "reunion_finalizada",
      idGrupo: reunion.idGrupo,
      ...plantillasNotificacion.reunionFinalizada(reunion.titulo, reunion.grupo.nombre, reunion.idReunion, duracionMinutos(minutos), entraron, finalizador),
    }));
  }
  return true;
}

/** Finaliza para todos: solo el lider o quien creo la reunion. */
export async function finalizarReunion(idUsuario: number, idReunion: number) {
  const reunion = await prisma.reunion.findUnique({ where: { idReunion }, include: { grupo: { select: { nombre: true } } } });
  if (!reunion) throw new ErrorDeNegocio("Esa reunión ya no existe");
  const integrante = await requerirParticipante(idUsuario, reunion.idGrupo);
  if (!esModerador(reunion, integrante)) {
    throw new ErrorDeNegocio("Solo el líder o quien creó la reunión puede finalizarla");
  }

  if (!reunion.videollamada) throw new ErrorDeNegocio("Esta reunión no tiene videollamada");
  if (!salaAbierta(estadoReunion(reunion, new Date()))) throw new ErrorDeNegocio("La sala no está abierta");

  const cerrada = await marcarFinalizada(reunion, new Date(), idUsuario);
  if (cerrada && reunion.salaUrl) {
    try {
      await proveedorVideo.cerrarSala(reunion.salaUrl);
    } catch {
      console.error("[video] No se pudo cerrar la sala; vencera sola");
    }
  }
  return reunion.idGrupo;
}

/** Cierra la sala en el proveedor sin fallar: si no se puede, vence sola. */
async function cerrarSalaSinFallar(salaUrl: string | null) {
  if (!salaUrl) return;
  try {
    await proveedorVideo.cerrarSala(salaUrl);
  } catch {
    console.error("[video] No se pudo cerrar la sala; vencera sola");
  }
}

/**
 * Cierre perezoso (no hay cron): finaliza con la hora de cierre de la sala las que ya vencieron y
 * las que quedaron vacias (ver `cerrarSalasVacias`).
 */
export async function cerrarReunionesVencidas(idsGrupo: number[], idReunion?: number) {
  if (idsGrupo.length === 0) return;
  const vencidas = await prisma.reunion.findMany({
    where: {
      ...(idReunion === undefined ? {} : { idReunion }),
      idGrupo: { in: idsGrupo },
      videollamada: true,
      finalizadaEn: null,
      fin: { lt: new Date(Date.now() - CIERRE_MIN * MS_MIN) },
    },
    include: { grupo: { select: { nombre: true } } },
  });
  for (const reunion of vencidas) {
    const cerrada = await marcarFinalizada(reunion, ventanaSala(reunion.inicio, reunion.fin).cierre, null);
    if (cerrada) await cerrarSalaSinFallar(reunion.salaUrl);
  }
  await cerrarSalasVacias(idsGrupo, idReunion);
}

/** Sala confirmada vacia: antes del inicio solo se limpia `iniciadaEn`; despues, la reunion termina. */
async function resolverSalaVacia(
  reunion: Parameters<typeof marcarFinalizada>[0] & { inicio: Date; fin: Date; videollamada: boolean; finalizadaEn: Date | null; salaUrl: string | null },
  ahora: Date,
) {
  const accion = accionSalaVacia(reunion, ahora);
  if (accion === "limpiar_inicio") {
    await prisma.reunion.updateMany({ where: { idReunion: reunion.idReunion, finalizadaEn: null }, data: { iniciadaEn: null } });
    return;
  }
  if (accion !== "finalizar") return;
  const cierre = ventanaSala(reunion.inicio, reunion.fin).cierre;
  const cerrada = await marcarFinalizada(reunion, ahora < cierre ? ahora : cierre, null);
  if (cerrada) await cerrarSalaSinFallar(reunion.salaUrl);
}

/**
 * Una reunion iniciada cuya sala quedo sin nadie (todos salieron, cerraron la pestana o perdieron
 * la conexion) deja de estar "en curso". Se detecta preguntando al proveedor, sin cron ni webhooks
 * (Render free se duerme). La gracia evita cerrar la sala que alguien esta abriendo en este momento.
 */
async function cerrarSalasVacias(idsGrupo: number[], idReunion?: number) {
  if (idsGrupo.length === 0) return;
  const ahora = new Date();
  const limite = new Date(ahora.getTime() - GRACIA_SALA_VACIA_MIN * MS_MIN);
  const candidatas = await prisma.reunion.findMany({
    where: {
      ...(idReunion === undefined ? {} : { idReunion }),
      idGrupo: { in: idsGrupo },
      videollamada: true,
      finalizadaEn: null,
      salaUrl: { not: null },
      iniciadaEn: { not: null, lte: limite },
    },
    include: { grupo: { select: { nombre: true } }, asistentes: { select: { fechaEntrada: true } } },
  });

  for (const reunion of candidatas) {
    // Las vencidas ya las cerro el cierre por horario.
    if (!salaAbierta(estadoReunion(reunion, ahora))) continue;
    const ultimaEntrada = Math.max(0, ...reunion.asistentes.map((a) => a.fechaEntrada?.getTime() ?? 0));
    if (ultimaEntrada > limite.getTime()) continue;
    if (!reunion.salaUrl) continue;

    const conectados = await proveedorVideo.participantesConectados(reunion.salaUrl);
    if (conectados !== 0) continue;

    await resolverSalaVacia(reunion, ahora);
  }
}

/** La pagina de sala la llama al llegar el contador a cero. */
export async function cerrarSiVencio(idUsuario: number, idReunion: number) {
  const reunion = await prisma.reunion.findUnique({ where: { idReunion }, select: { idGrupo: true } });
  if (!reunion) throw new ErrorDeNegocio("Esa reunión ya no existe");
  await requerirParticipante(idUsuario, reunion.idGrupo);
  await cerrarReunionesVencidas([reunion.idGrupo], idReunion);
  return reunion.idGrupo;
}

const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

/**
 * La sala la llama cuando quien sale cree ser la ultima persona: si el proveedor confirma que ya
 * no queda nadie, la reunion termina (sin esperar a que pase la gracia del cierre perezoso).
 * Devuelve el grupo para revalidar. Nunca falla por un problema del proveedor.
 */
export async function registrarSalida(idUsuario: number, idReunion: number) {
  const reunion = await prisma.reunion.findUnique({ where: { idReunion }, include: { grupo: { select: { nombre: true } } } });
  if (!reunion) throw new ErrorDeNegocio("Esa reunión ya no existe");
  await requerirParticipante(idUsuario, reunion.idGrupo);

  const abierta = reunion.videollamada && reunion.salaUrl && reunion.iniciadaEn && !reunion.finalizadaEn && salaAbierta(estadoReunion(reunion, new Date()));
  if (!abierta || !reunion.salaUrl) return reunion.idGrupo;

  let conectados = await proveedorVideo.participantesConectados(reunion.salaUrl);
  // El proveedor puede tardar un instante en registrar la salida de quien acaba de irse.
  if (conectados !== null && conectados > 0) {
    await esperar(1500);
    conectados = await proveedorVideo.participantesConectados(reunion.salaUrl);
  }
  if (conectados === 0) await resolverSalaVacia(reunion, new Date());
  return reunion.idGrupo;
}

export async function responderReunion(
  idUsuario: number,
  idReunion: number,
  respuesta: "asistire" | "no_asistire",
) {
  const reunion = await prisma.reunion.findUnique({ where: { idReunion } });
  if (!reunion) throw new ErrorDeNegocio("Esa reunión ya no existe");
  await requerirParticipante(idUsuario, reunion.idGrupo);
  if (estadoReunion(reunion, new Date()) === "terminada") throw new ErrorDeNegocio("Esa reunión ya terminó");

  // upsert: quien se unio al grupo despues de programarla tambien puede responder.
  await prisma.reunionAsistente.upsert({
    where: { idReunion_idUsuario: { idReunion, idUsuario } },
    create: { idReunion, idUsuario, respuesta, fechaRespuesta: new Date() },
    update: { respuesta, fechaRespuesta: new Date() },
  });
  return reunion.idGrupo;
}

/** Solo quien la creo o el lider del grupo. */
export async function cancelarReunion(idUsuario: number, idReunion: number) {
  const reunion = await prisma.reunion.findUnique({ where: { idReunion } });
  if (!reunion) throw new ErrorDeNegocio("Esa reunión ya no existe");
  const integrante = await requerirParticipante(idUsuario, reunion.idGrupo);
  if (reunion.idCreador !== idUsuario && integrante.rol !== "lider") {
    throw new ErrorDeNegocio("Solo quien la programó o el líder puede cancelarla");
  }

  if (reunion.iniciadaEn) throw new ErrorDeNegocio("La reunión ya empezó: finalízala en lugar de cancelarla");
  if (estadoReunion(reunion, new Date()) === "terminada") throw new ErrorDeNegocio("Esa reunión ya terminó");

  await prisma.reunion.delete({ where: { idReunion } });

  if (reunion.salaUrl) {
    try {
      await proveedorVideo.borrarSala(reunion.salaUrl);
    } catch {
      console.error("[video] No se pudo borrar la sala; vencera sola");
    }
  }
  return reunion.idGrupo;
}

/** Detalle de una reunion para integrantes aceptados (observadores incluidos) o `null`. */
export async function obtenerReunion(idUsuario: number, idReunion: number) {
  const existente = await prisma.reunion.findUnique({ where: { idReunion }, select: { idGrupo: true } });
  if (!existente) return null;
  const integrante = await integranteAceptado(idUsuario, existente.idGrupo);
  if (!integrante) return null;

  await cerrarReunionesVencidas([existente.idGrupo], idReunion);

  const reunion = await prisma.reunion.findUnique({
    where: { idReunion },
    include: {
      grupo: { select: { idGrupo: true, nombre: true, estado: true, evaluacion: { select: { idCurso: true } } } },
      creador: { select: { idUsuario: true, nombre: true, apellidos: true } },
      finalizador: { select: { idUsuario: true, nombre: true, apellidos: true } },
      asistentes: {
        select: {
          idUsuario: true,
          respuesta: true,
          fechaEntrada: true,
          usuario: { select: { nombre: true, apellidos: true, fotoUrl: true } },
        },
      },
    },
  });
  if (!reunion) return null;

  const ahora = new Date();
  const [conParticipantes] = await soloParticipantes([reunion]);
  const vigente = comoVigente(conParticipantes, ahora, reunion.grupo.estado === "activo");
  return {
    reunion: sinSala(vigente),
    rol: integrante.rol,
    moderador: esModerador(vigente, { rol: integrante.rol, idUsuario }),
    estado: estadoReunion(vigente, ahora),
  };
}

/** La reunion con la sala abierta del grupo (para la franja y "Unirse a la reunion en curso"). */
export async function reunionEnCursoDelGrupo(idUsuario: number, idGrupo: number) {
  const integrante = await integranteAceptado(idUsuario, idGrupo);
  if (!integrante) return null;

  // Una sala que quedo vacia no debe seguir ofreciendo "Unirse".
  await cerrarSalasVacias([idGrupo]);

  const ahora = new Date();
  const candidatas = await prisma.reunion.findMany({
    where: {
      idGrupo,
      videollamada: true,
      inicio: { lte: new Date(ahora.getTime() + APERTURA_MIN * MS_MIN) },
      fin: { gt: new Date(ahora.getTime() - CIERRE_MIN * MS_MIN) },
    },
    include: { grupo: { select: { nombre: true, estado: true } } },
    orderBy: { inicio: "desc" },
  });
  // Las reabribles (cerradas solas por sala vacia) siguen ofreciendo "Unirse".
  const vigentes = candidatas.map((r) => comoVigente(r, ahora, r.grupo.estado === "activo"));
  const activa = vigentes.find((r) => salaAbierta(estadoReunion(r, ahora)));
  if (!activa) return null;
  return { ...sinSala(activa), estado: estadoReunion(activa, ahora), rol: integrante.rol };
}

/** Reuniones de mis grupos (donde participo) dentro de un rango, para el Calendario. */
export async function reunionesDelUsuarioEntre(idUsuario: number, desde: Date, hasta: Date) {
  const reuniones = await prisma.reunion.findMany({
    where: {
      inicio: { lt: hasta },
      fin: { gt: desde },
      grupo: {
        integrantes: { some: { idUsuario, estadoInvitacion: "aceptada", rol: { not: "observador" } } },
      },
    },
    select: {
      idReunion: true,
      idGrupo: true,
      titulo: true,
      inicio: true,
      fin: true,
      videollamada: true,
      iniciadaEn: true,
      finalizadaEn: true,
      grupo: { select: { nombre: true } },
    },
    orderBy: { inicio: "asc" },
  });
  return ocupadasHasta(reuniones, desde);
}

/** Recorta cada reunion a lo que realmente ocupo (cerrada antes de su fin) y descarta las que no ocuparon nada. */
function ocupadasHasta<T extends { inicio: Date; fin: Date; finalizadaEn: Date | null }>(reuniones: T[], desde: Date): T[] {
  return reuniones.flatMap((reunion) => {
    const intervalo = intervaloOcupado(reunion);
    return intervalo && intervalo.fin > desde ? [{ ...reunion, fin: intervalo.fin }] : [];
  });
}

/** Reuniones puntuales del grupo para bloquear sus sugerencias de disponibilidad. */
export async function reunionesDelGrupoEntre(idUsuario: number, idGrupo: number, desde: Date, hasta: Date) {
  await requerirParticipante(idUsuario, idGrupo);
  await cerrarReunionesVencidas([idGrupo]);
  const reuniones = await prisma.reunion.findMany({
    where: { idGrupo, inicio: { lt: hasta }, fin: { gt: desde } },
    select: { idReunion: true, titulo: true, inicio: true, fin: true, lugar: true, finalizadaEn: true },
    orderBy: { inicio: "asc" },
  });
  return ocupadasHasta(reuniones, desde);
}
