import { z } from "zod";

const horaHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora invalida (HH:mm)");
// Los cursos no dictan clase en domingo (7): ver src/lib/dates.ts DIAS_SEMANA_CURSO.
const diaSemana = z.number().int().min(1, "Dia invalido").max(6, "Los cursos no se dictan en domingo");

export const crearCursoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  codigo: z.string().trim().max(30).optional().or(z.literal("")),
  docente: z.string().trim().max(120).optional().or(z.literal("")),
  modalidad: z.enum(["presencial", "remoto"]).optional(),
});

export const actualizarCursoSchema = crearCursoSchema.extend({
  activo: z.boolean(),
});

export const crearHorarioSchema = z
  .object({
    diaSemana,
    horaInicio: horaHHMM,
    horaFin: horaHHMM,
  })
  .refine((datos) => datos.horaInicio !== datos.horaFin, {
    message: "La hora de inicio y fin no pueden ser iguales",
    path: ["horaFin"],
  });

const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida");

export const crearEvaluacionSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
    fechaApertura: fechaISO.optional().or(z.literal("")),
    fechaCierre: fechaISO,
    requiereEntrega: z.boolean(),
  })
  .refine((datos) => !datos.fechaApertura || datos.fechaApertura <= datos.fechaCierre, {
    message: "La apertura no puede ser despues del cierre",
    path: ["fechaApertura"],
  });
