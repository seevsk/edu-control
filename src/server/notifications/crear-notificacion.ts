import { prisma } from "@/server/db/client";
import { EVENTOS_NOTIFICACION, type TipoNotificacionConfigurado } from "./eventos";

/**
 * Crea la fila de notificacion in-app y decide estado_correo segun la politica de EVENTOS_NOTIFICACION.
 * No envia el correo: eso lo hace el EmailSender (pendiente, ver AGENTS.md 8.6).
 * Nunca notifiques a quien realizo la accion: eso lo controla quien llama a esta funcion.
 */
export async function crearNotificacion(datos: {
  idUsuario: number;
  tipo: TipoNotificacionConfigurado;
  mensaje: string;
  enlace?: string;
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

  return prisma.notificacion.create({
    data: {
      idUsuario: datos.idUsuario,
      tipo: datos.tipo,
      mensaje: datos.mensaje,
      enlace: datos.enlace,
      estadoCorreo,
    },
  });
}
