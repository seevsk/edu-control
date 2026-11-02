import { z } from "zod";

const horaHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora invalida (HH:mm)");
// Los cursos no dictan clase en domingo (7): ver src/lib/dates.ts DIAS_SEMANA_CURSO.
const diaSemana = z.coerce.number().int().min(1, "Dia invalido").max(6, "Los cursos no se dictan en domingo");

const camposCurso = {
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  codigo: z.string().trim().max(30).optional().or(z.literal("")),
  docente: z.string().trim().max(120).optional().or(z.literal("")),
  modalidad: z.enum(["presencial", "remoto"]).optional(),
};

const camposHoras = {
  horaInicio: horaHHMM,
  horaFin: horaHHMM,
};

const camposHorario = {
  dias: z.array(diaSemana).min(1, "Elige al menos un día"),
  ...camposHoras,
};

const rangoHorarioValido = {
  check: (datos: { horaInicio: string; horaFin: string }) => datos.horaFin > datos.horaInicio,
  params: { message: "La hora de fin debe ser posterior a la hora de inicio", path: ["horaFin"] },
};

export const crearCursoSchema = z
  .object({
    ...camposCurso,
    codigo: z.string().trim().min(1, "El código es obligatorio").max(30),
    ...camposHorario,
  })
  .refine(rangoHorarioValido.check, rangoHorarioValido.params);

export const actualizarCursoSchema = z.object({
  ...camposCurso,
  activo: z.boolean(),
});

export const crearHorarioSchema = z
  .object(camposHorario)
  .refine(rangoHorarioValido.check, rangoHorarioValido.params);

export const actualizarHorarioCursoSchema = z
  .object({ diaSemana, ...camposHoras })
  .refine(rangoHorarioValido.check, rangoHorarioValido.params);

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
