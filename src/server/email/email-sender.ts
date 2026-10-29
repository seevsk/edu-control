export interface DatosEmail {
  idNotificacion: number;
  destinatario: string;
  asunto: string;
  cuerpo: string;
  enlace?: string;
}

export interface ResultadoEnvio {
  ok: boolean;
}

export interface EmailSender {
  enviar(datos: DatosEmail): Promise<ResultadoEnvio>;
}
