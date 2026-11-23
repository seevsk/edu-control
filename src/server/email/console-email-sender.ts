import type { EmailSender, DatosEmail, ResultadoEnvio } from "./email-sender";

/**
 * Desarrollo: no hay dominio verificado en Resend todavia (ver AGENTS.md 13), asi que el correo se
 * imprime en consola en su version de texto. El HTML se revisa con `npm run correos:previsualizar`.
 */
export class ConsoleEmailSender implements EmailSender {
  async enviar(datos: DatosEmail): Promise<ResultadoEnvio> {
    console.log(
      `\n[correo] -> ${datos.destinatario}\nAsunto: ${datos.asunto}\n\n${datos.texto}\n(notificacion #${datos.idNotificacion})\n`,
    );
    return { ok: true };
  }
}
