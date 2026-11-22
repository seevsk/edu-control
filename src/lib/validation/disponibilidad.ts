import "./configurar-zod";
import { z } from "zod";

// La interfaz solo ofrece intervalos de 30 minutos; el servidor lo exige igual.
const horaHHMM = z.string().regex(/^([01]\d|2[0-3]):(00|30)$/, "Hora inválida");
const dia = z.coerce.number().int().min(1, "Día inválido").max(7, "Día inválido");

const camposComunes = {
  tipo: z.enum(["laboral", "familiar", "personal"], { message: "Elige el tipo de bloque" }),
  horaInicio: horaHHMM,
  horaFin: horaHHMM,
  detalle: z.string().trim().max(120, "El detalle admite hasta 120 caracteres").optional().or(z.literal("")),
  // Horario excepcional (decisión del usuario, 2026-11-16): el bloque puede terminar al día siguiente.
  excepcional: z.boolean().default(false),
};

const rangoHorarioValido = {
  check: (datos: { horaInicio: string; horaFin: string; excepcional: boolean }) =>
    datos.excepcional ? datos.horaFin !== datos.horaInicio : datos.horaFin > datos.horaInicio,
  params: {
    message: "La hora de fin debe ser posterior a la de inicio. Si termina al día siguiente, activa Horario excepcional",
    path: ["horaFin"],
  },
};

/** Al crear se pueden marcar varios dias: se guarda un bloque por dia. */
export const crearBloqueOcupadoSchema = z
  .object({ ...camposComunes, dias: z.array(dia).min(1, "Elige al menos un día").transform((dias) => [...new Set(dias)]) })
  .refine(rangoHorarioValido.check, rangoHorarioValido.params);

/** Al editar, el bloque es una sola fila: un solo dia. */
export const actualizarBloqueOcupadoSchema = z
  .object({ ...camposComunes, diaSemana: dia })
  .refine(rangoHorarioValido.check, rangoHorarioValido.params);
