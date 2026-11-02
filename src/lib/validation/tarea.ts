import { z } from "zod";

function esFechaISOReal(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

export const crearTareaSchema = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio").max(160),
  descripcion: z.string().trim().max(1000).optional().or(z.literal("")),
  peso: z.coerce.number().int().min(1, "El peso va de 1 a 3").max(3, "El peso va de 1 a 3"),
  idAsignado: z.string()
    .min(1, "Selecciona un responsable")
    .regex(/^[1-9]\d*$/, "Selecciona un responsable válido")
    .refine((valor) => Number(valor) <= 2147483647, "Selecciona un responsable válido"),
  fechaLimite: z
    .string()
    .min(1, "La fecha límite es obligatoria")
    .refine(esFechaISOReal, "La fecha límite no es válida"),
});

export const motivoDevolucionSchema = z.string()
  .trim()
  .min(1, "Escribe el motivo de la devolución")
  .max(500, "El motivo admite hasta 500 caracteres");

export const reasignarTareaSchema = z.object({
  idAsignado: z.string().regex(/^[1-9]\d*$/, "Selecciona un responsable válido")
    .refine((valor) => Number(valor) <= 2147483647, "Selecciona un responsable válido")
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
  q: z.string().trim().max(160, "La búsqueda admite hasta 160 caracteres").optional().default(""),
  estado: z.enum(ESTADOS_TAREA).optional().or(z.literal("")),
  asignado: idRegistroSchema.optional().or(z.literal("")),
  foco: z.enum(["abiertas", "mias", "sin_asignar", "vencidas"]).optional().or(z.literal("")),
  vista: z.enum(["tablero", "lista"]).optional(),
});

export type FiltrosTarea = Partial<z.infer<typeof filtrosTareaSchema>>;
