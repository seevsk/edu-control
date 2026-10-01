import { prisma } from "@/server/db/client";
import { emailSender } from "@/server/email";
import { EVENTOS_NOTIFICACION, type TipoNotificacionConfigurado } from "./eventos";

/**
 * Crea la fila de notificacion in-app, decide estado_correo segun la politica de
 * EVENTOS_NOTIFICACION, y si corresponde manda el correo ahi mismo (sin colas ni reintentos
 * automaticos en el MVP, ver AGENTS.md 8.6) actualizando estado_correo a enviado/fallido.
 * Nunca notifiques a quien realizo la accion: eso lo controla quien llama a esta funcion.
 */
export async function crearNotificacion(datos: {
  idUsuario: number;
  tipo: TipoNotificacionConfigurado;
  mensaje: string;
  enlace: string;
  asunto: string;
  idGrupo?: number;
}) {
  const config = EVENTOS_NOTIFICACION[datos.tipo];

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
    const destinatario = await prisma.usuario.findUnique({ where: { idUsuario: datos.idUsuario } });
    if (destinatario) {
      const resultado = await emailSender.enviar({
        idNotificacion: notificacion.idNotificacion,
        destinatario: destinatario.correo,
        asunto: datos.asunto,
        cuerpo: datos.mensaje,
      });
      await prisma.notificacion.update({
        where: { idNotificacion: notificacion.idNotificacion },
        data: { estadoCorreo: resultado.ok ? "enviado" : "fallido" },
      });
    }
  }

  return notificacion;
}
