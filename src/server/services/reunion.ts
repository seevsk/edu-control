import { prisma } from "@/server/db/client";
import { ErrorDeNegocio } from "@/lib/errores";
import { etiquetaFechaLarga, etiquetaMinutos } from "@/lib/calendario";
import { crearNotificacion } from "@/server/notifications/crear-notificacion";
import { plantillasNotificacion } from "@/server/notifications/templates";
import type { crearReunionSchema } from "@/lib/validation/reunion";
import type { z } from "zod";

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

/** Reuniones del grupo (proximas primero) con la asistencia. Solo para integrantes aceptados. */
export async function listarReunionesGrupo(idUsuario: number, idGrupo: number) {
  const yo = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
  });
  if (!yo || yo.estadoInvitacion !== "aceptada") throw new ErrorDeNegocio("Grupo no encontrado");

  const ahora = new Date();
  const incluir = {
    creador: { select: { idUsuario: true, nombre: true } },
    asistentes: {
      select: {
        idUsuario: true,
        respuesta: true,
        usuario: { select: { nombre: true, apellidos: true, fotoUrl: true } },
      },
    },
  } as const;

  const [proximas, pasadas] = await Promise.all([
    prisma.reunion.findMany({ where: { idGrupo, fin: { gte: ahora } }, include: incluir, orderBy: { inicio: "asc" } }),
    prisma.reunion.findMany({
      where: { idGrupo, fin: { lt: ahora } },
      include: incluir,
      orderBy: { inicio: "desc" },
      take: 5,
    }),
  ]);

  return { proximas, pasadas, rolActual: yo.rol };
}

export async function crearReunion(idUsuario: number, idGrupo: number, datos: z.infer<typeof crearReunionSchema>) {
  const { grupo } = await requerirParticipante(idUsuario, idGrupo);
  if (grupo.estado !== "activo") throw new ErrorDeNegocio("El grupo está finalizado");

  const inicio = new Date(`${datos.fecha}T${datos.horaInicio}:00-05:00`);
  const fin = new Date(`${datos.fecha}T${datos.horaFin}:00-05:00`);
  if (fin <= new Date()) throw new ErrorDeNegocio("La reunión ya habría terminado: elige una fecha futura");

  const participantes = await prisma.grupoIntegrante.findMany({
    where: { idGrupo, estadoInvitacion: "aceptada", rol: { not: "observador" } },
    select: { idUsuario: true },
  });

  // El create anidado inserta reunion y asistentes de forma atomica.
  const reunion = await prisma.reunion.create({
      data: {
        idGrupo,
        idCreador: idUsuario,
        titulo: datos.titulo,
        inicio,
        fin,
        lugar: datos.lugar || null,
        enlace: datos.enlace || null,
        asistentes: {
          create: participantes.map((p) => ({
            idUsuario: p.idUsuario,
            // Quien la programa asiste: no tiene sentido pedirle que confirme.
            respuesta: p.idUsuario === idUsuario ? "asistire" : "pendiente",
            fechaRespuesta: p.idUsuario === idUsuario ? new Date() : null,
          })),
        },
      },
    });

  const cuando = `${etiquetaFechaLarga(datos.fecha).toLowerCase()}, ${etiquetaMinutos(
    Number(datos.horaInicio.slice(0, 2)) * 60 + Number(datos.horaInicio.slice(3)),
  )}`;
  for (const participante of participantes) {
    if (participante.idUsuario === idUsuario) continue;
    await crearNotificacion({
      idUsuario: participante.idUsuario,
      tipo: "reunion_programada",
      idGrupo,
      ...plantillasNotificacion.reunionProgramada(datos.titulo, grupo.nombre, idGrupo, cuando),
    });
  }

  return reunion;
}

export async function responderReunion(
  idUsuario: number,
  idReunion: number,
  respuesta: "asistire" | "no_asistire",
) {
  const reunion = await prisma.reunion.findUnique({ where: { idReunion } });
  if (!reunion) throw new ErrorDeNegocio("Esa reunión ya no existe");
  await requerirParticipante(idUsuario, reunion.idGrupo);
  if (reunion.fin < new Date()) throw new ErrorDeNegocio("Esa reunión ya pasó");

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

  await prisma.reunion.delete({ where: { idReunion } });
  return reunion.idGrupo;
}

/** Reuniones de mis grupos (donde participo) dentro de un rango, para el Calendario. */
export async function reunionesDelUsuarioEntre(idUsuario: number, desde: Date, hasta: Date) {
  return prisma.reunion.findMany({
    where: {
      inicio: { lt: hasta },
      fin: { gt: desde },
      grupo: {
        integrantes: { some: { idUsuario, estadoInvitacion: "aceptada", rol: { not: "observador" } } },
      },
    },
    select: { idReunion: true, idGrupo: true, titulo: true, inicio: true, fin: true, grupo: { select: { nombre: true } } },
    orderBy: { inicio: "asc" },
  });
}
