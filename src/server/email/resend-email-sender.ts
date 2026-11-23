import type { DatosEmail, EmailSender, ResultadoEnvio } from "./email-sender";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const TIEMPO_MAXIMO_MS = 8000;

interface ResendEmailSenderConfig {
  apiKey: string;
  emailFrom: string;
}

/** Produccion/demo: envia correos transaccionales mediante la API HTTP de Resend. */
export class ResendEmailSender implements EmailSender {
  constructor(private readonly config: ResendEmailSenderConfig) {}

  async enviar(datos: DatosEmail): Promise<ResultadoEnvio> {
    try {
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
          html: datos.html,
          text: datos.texto,
        }),
        // Sin tope, un Resend colgado dejaria la accion del usuario esperando indefinidamente.
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });

      if (!respuesta.ok) {
        console.error(
          `[correo] Resend rechazo la notificacion #${datos.idNotificacion}: HTTP ${respuesta.status}`,
        );
        return { ok: false };
      }

      return { ok: true };
    } catch (error) {
      const agotado = error instanceof Error && error.name === "TimeoutError";
      console.error(`[correo] ${agotado ? "Tiempo agotado al enviar" : "No se pudo enviar"} la notificacion #${datos.idNotificacion}`);
      return { ok: false };
    }
  }
}
