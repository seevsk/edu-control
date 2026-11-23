import { env } from "@/lib/env";
import { prisma } from "@/server/db/client";
import { emailSender } from "@/server/email";
import type { ContenidoCorreo } from "@/server/email/contenido";
import { construirCorreo } from "./correo";
import { EVENTOS_NOTIFICACION, type TipoNotificacionConfigurado } from "./eventos";

type TipoActividad = {
  [K in TipoNotificacionConfigurado]: (typeof EVENTOS_NOTIFICACION)[K]["actividad"] extends true ? K : never;
}[TipoNotificacionConfigurado];

/** Los tipos de actividad exigen el grupo: sin él no se puede respetar el silencio de correo_actividad. */
export type DatosNotificacion = {
  idUsuario: number;
  mensaje: string;
  enlace: string;
  asunto: string;
  /** Contenido del correo (plantillas de templates.ts); sin él se arma uno básico con el mensaje. */
  correo?: ContenidoCorreo;
} & (
  | { tipo: TipoActividad; idGrupo: number }
  | { tipo: Exclude<TipoNotificacionConfigurado, TipoActividad>; idGrupo?: number }
);

/**
 * Crea la fila de notificacion in-app, decide estado_correo segun la politica de
 * EVENTOS_NOTIFICACION, y si corresponde manda el correo ahi mismo (sin colas ni reintentos
 * automaticos en el MVP, ver AGENTS.md 8.6) actualizando estado_correo a enviado/fallido.
 * Nunca notifiques a quien realizo la accion: eso lo controla quien llama a esta funcion.
 *
 * Nunca lanza: la accion de negocio ya ocurrio y un aviso que falla no debe hacerla parecer fallida.
 * Devuelve null si no se pudo crear (o la cuenta esta eliminada).
 */
export async function crearNotificacion(datos: DatosNotificacion) {
  try {
    return await crearNotificacionInterna(datos);
  } catch (error) {
    console.error(`[notificacion] No se pudo crear el aviso "${datos.tipo}":`, error instanceof Error ? error.name : "error");
    return null;
  }
}

/** Envia varios avisos en paralelo; el fallo de uno no corta a los demas. */
export async function notificarVarios(lista: DatosNotificacion[]) {
  await Promise.allSettled(lista.map((datos) => crearNotificacion(datos)));
}

async function crearNotificacionInterna(datos: DatosNotificacion) {
  const config = EVENTOS_NOTIFICACION[datos.tipo];

  // Una cuenta eliminada no recibe avisos ni correos.
  const destino = await prisma.usuario.findUnique({
    where: { idUsuario: datos.idUsuario },
    select: { eliminadoEn: true, correo: true },
  });
  if (!destino || destino.eliminadoEn) return null;

  let estadoCorreo: "no_aplica" | "pendiente" = "no_aplica";
  if (config.correo) {
    if (config.actividad && datos.idGrupo) {
      const integrante = await prisma.grupoIntegrante.findUnique({
        where: { idGrupo_idUsuario: { idGrupo: datos.idGrupo, idUsuario: datos.idUsuario } },
      });
      estadoCorreo = integrante?.correoActividad === false ? "no_aplica" : "pendiente";
    } else {
      estadoCorreo = "pendiente";
    }
  }

  const notificacion = await prisma.notificacion.create({
    data: {
      idUsuario: datos.idUsuario,
      tipo: datos.tipo,
      mensaje: datos.mensaje,
      enlace: datos.enlace,
      estadoCorreo,
    },
  });

  if (estadoCorreo === "pendiente") {
    let enviado = false;
    try {
      if (destino.correo.trim()) {
        const correo = construirCorreo(datos, env.APP_URL);
        const resultado = await emailSender.enviar({
          idNotificacion: notificacion.idNotificacion,
          destinatario: destino.correo,
          ...correo,
        });
        enviado = resultado.ok;
      }
    } catch {
      enviado = false;
    }
    try {
      await prisma.notificacion.update({
        where: { idNotificacion: notificacion.idNotificacion },
        data: { estadoCorreo: enviado ? "enviado" : "fallido" },
      });
    } catch {
      // Si no se puede registrar el resultado, la reconciliación de la Bandeja la marcará fallida.
    }
  }

  return notificacion;
}
