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

const horaHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora invalida (HH:mm)");

export const crearBloqueOcupadoSchema = z
  .object({
    tipo: z.enum(["laboral", "familiar", "personal"]),
    diaSemana: z.coerce.number().int().min(1, "Dia invalido").max(7, "Dia invalido"),
    horaInicio: horaHHMM,
    horaFin: horaHHMM,
  })
  .refine((datos) => datos.horaInicio !== datos.horaFin, {
    message: "La hora de inicio y fin no pueden ser iguales",
    path: ["horaFin"],
  });

export const eliminarCuentaSchema = z.object({
  confirmacion: z.string().refine((v) => v.trim().toLowerCase() === "eliminar", {
    message: "Escribe ELIMINAR para confirmar",
  }),
});
