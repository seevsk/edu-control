import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().min(1, "Falta DATABASE_URL"),
    APP_URL: z.url("APP_URL debe ser una URL valida"),
    GOOGLE_CLIENT_ID: z.string().min(1, "Falta GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: z.string().min(1, "Falta GOOGLE_CLIENT_SECRET"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET debe tener al menos 32 caracteres"),
    EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
    RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY no puede estar vacia").optional(),
    EMAIL_FROM: z.email("EMAIL_FROM debe ser un correo valido").optional(),
  })
  .superRefine((datos, ctx) => {
    if (datos.EMAIL_PROVIDER !== "resend") return;

    if (!datos.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "Falta RESEND_API_KEY para usar Resend",
      });
    }
    if (!datos.EMAIL_FROM) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_FROM"],
        message: "Falta EMAIL_FROM para usar Resend",
      });
    }
  });

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  // En Render, si no se define APP_URL se usa la URL publica que Render inyecta en cada servicio.
  APP_URL: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
});
