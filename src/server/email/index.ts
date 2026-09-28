import { ConsoleEmailSender } from "./console-email-sender";
import type { EmailSender } from "./email-sender";

// Cuando exista un dominio verificado en Resend, este es el unico lugar que cambia
// (ver AGENTS.md 8.6 y 13: RESEND_API_KEY / EMAIL_FROM).
export const emailSender: EmailSender = new ConsoleEmailSender();
