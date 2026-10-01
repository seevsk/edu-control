import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "Falta DATABASE_URL"),
  APP_URL: z.url("APP_URL debe ser una URL valida"),
  GOOGLE_CLIENT_ID: z.string().min(1, "Falta GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "Falta GOOGLE_CLIENT_SECRET"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET debe tener al menos 32 caracteres"),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  APP_URL: process.env.APP_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
});
