import { z } from "zod";

const horaHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");
const dia = z.coerce.number().int().min(1, "Día inválido").max(7, "Día inválido");

const camposComunes = {
  tipo: z.enum(["laboral", "familiar", "personal"], { message: "Elige el tipo de bloque" }),
  horaInicio: horaHHMM,
  horaFin: horaHHMM,
  detalle: z.string().trim().max(120, "El detalle admite hasta 120 caracteres").optional().or(z.literal("")),
};

const rangoHorarioValido = {
  check: (datos: { horaInicio: string; horaFin: string }) => datos.horaFin > datos.horaInicio,
  params: { message: "La hora de fin debe ser posterior a la hora de inicio", path: ["horaFin"] },
};

/** Al crear se pueden marcar varios dias: se guarda un bloque por dia. */
export const crearBloqueOcupadoSchema = z
  .object({ ...camposComunes, dias: z.array(dia).min(1, "Elige al menos un día") })
  .refine(rangoHorarioValido.check, rangoHorarioValido.params);

/** Al editar, el bloque es una sola fila: un solo dia. */
export const actualizarBloqueOcupadoSchema = z
  .object({ ...camposComunes, diaSemana: dia })
  .refine(rangoHorarioValido.check, rangoHorarioValido.params);
