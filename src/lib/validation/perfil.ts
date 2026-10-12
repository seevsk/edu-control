import { z } from "zod";

export const actualizarPerfilSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  apellidos: z.string().trim().max(120).optional().or(z.literal("")),
  tipoCuenta: z.enum(["estudiante", "profesor"]),
  institucion: z.string().trim().max(160).optional().or(z.literal("")),
  carrera: z.string().trim().max(160).optional().or(z.literal("")),
  ciclo: z.coerce.number().int().min(1).max(20).optional().or(z.literal("")),
  biografia: z.string().trim().max(300).optional().or(z.literal("")),
  trabaja: z.boolean(),
  visibleEnBusqueda: z.boolean(),
});

export const eliminarCuentaSchema = z.object({
  confirmacion: z.string().refine((v) => v.trim().toLowerCase() === "eliminar", {
    message: "Escribe ELIMINAR para confirmar",
  }),
});
