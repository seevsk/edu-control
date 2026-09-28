import { z } from "zod";

export const crearTareaSchema = z.object({
  titulo: z.string().trim().min(1, "El titulo es obligatorio").max(160),
  descripcion: z.string().trim().max(1000).optional().or(z.literal("")),
  peso: z.coerce.number().int().min(1, "El peso va de 1 a 3").max(3, "El peso va de 1 a 3"),
  idAsignado: z.string().optional().or(z.literal("")),
  fechaLimite: z.string().optional().or(z.literal("")),
});

export const reasignarTareaSchema = z.object({
  idAsignado: z.string().optional().or(z.literal("")),
});

export const ESTADOS_TAREA = ["pendiente", "en_progreso", "en_revision", "completada"] as const;
