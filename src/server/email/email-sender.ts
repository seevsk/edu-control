export interface DatosEmail {
  idNotificacion: number;
  destinatario: string;
  asunto: string;
  /** HTML completo del correo (src/server/email/layout.ts). */
  html: string;
  /** Versión de texto plano equivalente. */
  texto: string;
}

export interface ResultadoEnvio {
  ok: boolean;
}

export interface EmailSender {
  enviar(datos: DatosEmail): Promise<ResultadoEnvio>;
}
