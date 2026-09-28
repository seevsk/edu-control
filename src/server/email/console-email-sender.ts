import type { EmailSender, DatosEmail, ResultadoEnvio } from "./email-sender";

/** Desarrollo: no hay dominio verificado en Resend todavia (ver AGENTS.md 13), asi que el correo se imprime en consola. */
export class ConsoleEmailSender implements EmailSender {
  async enviar(datos: DatosEmail): Promise<ResultadoEnvio> {
    console.log(
      `\n[correo] -> ${datos.destinatario}\nAsunto: ${datos.asunto}\n${datos.cuerpo}\n(notificacion #${datos.idNotificacion})\n`,
    );
    return { ok: true };
  }
}
