import { z } from "zod";

export const crearTareaSchema = z.object({
  titulo: z.string().trim().min(1, "El titulo es obligatorio").max(160),
  descripcion: z.string().trim().max(1000).optional().or(z.literal("")),
  peso: z.coerce.number().int().min(1, "El peso va de 1 a 3").max(3, "El peso va de 1 a 3"),
  idAsignado: z.string().optional().or(z.literal("")),
  fechaLimite: z.string().optional().or(z.literal("")),
});

export const reasignarTareaSchema = z.object({
  idAsignado: z.string().regex(/^[1-9]\d*$/, "Selecciona un responsable valido")
    .refine((valor) => Number(valor) <= 2147483647, "Selecciona un responsable valido")
    .optional().or(z.literal("")),
});

export const ESTADOS_TAREA = ["pendiente", "en_progreso", "en_revision", "completada"] as const;

export const idRegistroSchema = z.coerce.number().int().positive().max(2147483647);

export const contextoTareaSchema = z.object({
  idGrupo: idRegistroSchema,
  idTarea: idRegistroSchema,
  destino: z.enum(["lista", "tabla", "detalle"]),
});

export type DestinoTarea = z.infer<typeof contextoTareaSchema>["destino"];

export const cambiarEstadoTareaSchema = contextoTareaSchema.extend({
  nuevoEstado: z.enum(ESTADOS_TAREA),
});

export const filtrosTareaSchema = z.object({
  q: z.string().trim().max(160, "La busqueda admite hasta 160 caracteres").optional().default(""),
  estado: z.enum(ESTADOS_TAREA).optional().or(z.literal("")),
  asignado: idRegistroSchema.optional().or(z.literal("")),
  vista: z.enum(["tablero", "lista"]).optional(),
});
