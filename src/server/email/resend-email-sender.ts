import type { DatosEmail, EmailSender, ResultadoEnvio } from "./email-sender";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

interface ResendEmailSenderConfig {
  apiKey: string;
  emailFrom: string;
  appUrl: string;
}

/** Produccion/demo: envia correos transaccionales mediante la API HTTP de Resend. */
export class ResendEmailSender implements EmailSender {
  constructor(private readonly config: ResendEmailSenderConfig) {}

  async enviar(datos: DatosEmail): Promise<ResultadoEnvio> {
    try {
      const enlaceAbsoluto = datos.enlace
        ? new URL(datos.enlace, this.config.appUrl).toString()
        : null;
      const cuerpo = [
        datos.cuerpo,
        enlaceAbsoluto ? `Abrir en EduControl: ${enlaceAbsoluto}` : null,
        "",
        "Este es un mensaje automatico de EduControl.",
      ]
        .filter((linea): linea is string => linea !== null)
        .join("\n");

      const respuesta = await fetch(RESEND_EMAILS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `notificacion-${datos.idNotificacion}`,
        },
        body: JSON.stringify({
          from: `EduControl <${this.config.emailFrom}>`,
          to: [datos.destinatario],
          subject: datos.asunto,
          text: cuerpo,
        }),
      });

      if (!respuesta.ok) {
        console.error(
          `[correo] Resend rechazo la notificacion #${datos.idNotificacion}: HTTP ${respuesta.status}`,
        );
        return { ok: false };
      }

      return { ok: true };
    } catch {
      console.error(`[correo] No se pudo enviar la notificacion #${datos.idNotificacion}`);
      return { ok: false };
    }
  }
}
