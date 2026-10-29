import { env } from "@/lib/env";
import { ConsoleEmailSender } from "./console-email-sender";
import type { EmailSender } from "./email-sender";
import { ResendEmailSender } from "./resend-email-sender";

function crearEmailSender(): EmailSender {
  if (env.EMAIL_PROVIDER === "console") return new ConsoleEmailSender();

  // env.ts ya valida esta combinacion; la guarda mantiene el estrechamiento de TypeScript.
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error("La configuracion de correo esta incompleta");
  }

  return new ResendEmailSender({
    apiKey: env.RESEND_API_KEY,
    emailFrom: env.EMAIL_FROM,
    appUrl: env.APP_URL,
  });
}

export const emailSender = crearEmailSender();
