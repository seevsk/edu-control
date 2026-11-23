import type { ContenidoCorreo, CorreoRenderizado } from "@/server/email/contenido";
import { renderizarCorreo } from "@/server/email/layout";
import { EVENTOS_NOTIFICACION, type TipoNotificacionConfigurado } from "./eventos";

export interface DatosParaCorreo {
  tipo: TipoNotificacionConfigurado;
  asunto: string;
  mensaje: string;
  enlace: string;
  idGrupo?: number;
  correo?: ContenidoCorreo;
}

/**
 * Arma el correo de una notificación: el contenido de la plantilla (o uno básico a partir del
 * mensaje) dentro del layout común. Los correos de actividad llevan en el pie cómo silenciarlos.
 * Pura: la usan crear-notificacion.ts y la vista previa (scripts/previsualizar-correos.ts).
 */
export function construirCorreo(datos: DatosParaCorreo, appUrl: string): CorreoRenderizado {
  const contenido: ContenidoCorreo = datos.correo ?? {
    preheader: datos.mensaje,
    titular: datos.asunto,
    parrafos: [datos.mensaje],
    cta: "Abrir en EduControl",
    motivo: "Recibes este correo por tu actividad en EduControl.",
  };
  const actividad = EVENTOS_NOTIFICACION[datos.tipo].actividad;
  return renderizarCorreo({
    asunto: datos.asunto,
    contenido,
    enlace: datos.enlace,
    appUrl,
    enlaceSilenciar: actividad && datos.idGrupo ? `/grupos/${datos.idGrupo}/integrantes` : undefined,
  });
}
