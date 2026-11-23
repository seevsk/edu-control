/**
 * Contenido estructurado de un correo transaccional. Lo arma cada plantilla de notificación con
 * texto plano (sin HTML); el layout lo escapa y lo convierte en HTML y en texto.
 */
export interface DetalleCorreo {
  etiqueta: string;
  valor: string;
}

export interface ContenidoCorreo {
  /** Texto de vista previa que muestran las bandejas junto al asunto. */
  preheader: string;
  titular: string;
  /** Una o dos frases: qué pasó y qué se espera de la persona. */
  parrafos: string[];
  detalles?: DetalleCorreo[];
  /** Texto citado, por ejemplo el motivo de una devolución. */
  cita?: { etiqueta: string; texto: string };
  /** Verbo concreto del botón: "Ver la tarea", "Responder invitación". */
  cta: string;
  /** Por qué le llega el correo a esta persona. */
  motivo: string;
  /** Nombre del grupo, para el pie de los correos de actividad. */
  grupo?: string;
}

export interface CorreoRenderizado {
  asunto: string;
  html: string;
  texto: string;
}
