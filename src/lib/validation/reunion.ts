import { z } from "zod";

const horaHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");

export const crearReunionSchema = z
  .object({
    titulo: z.string().trim().min(1, "El título es obligatorio").max(120, "El título admite hasta 120 caracteres"),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    horaInicio: horaHHMM,
    horaFin: horaHHMM,
    lugar: z.string().trim().max(160, "El lugar admite hasta 160 caracteres").optional().or(z.literal("")),
    enlace: z
      .string()
      .trim()
      .refine((valor) => valor === "" || /^https?:\/\//i.test(valor), {
        message: "El enlace debe empezar con http:// o https://",
      })
      .optional()
      .or(z.literal("")),
  })
  .refine((datos) => datos.horaFin > datos.horaInicio, {
    message: "La hora de fin debe ser después de la de inicio",
    path: ["horaFin"],
  });

export const responderReunionSchema = z.object({
  respuesta: z.enum(["asistire", "no_asistire"]),
});
