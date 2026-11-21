export interface DatosEmail {
  idNotificacion: number;
  destinatario: string;
  asunto: string;
  cuerpo: string;
  enlace?: string;
  /** Texto que acompaña al enlace; por defecto "Abrir en EduControl". */
  textoEnlace?: string;
}

export interface ResultadoEnvio {
  ok: boolean;
}

export interface EmailSender {
  enviar(datos: DatosEmail): Promise<ResultadoEnvio>;
}
