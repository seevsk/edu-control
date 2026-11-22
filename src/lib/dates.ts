import { ErrorDeNegocio } from "./errores";
import { fechaCorta, hora, horaDeTime } from "./formato-fecha";

/** Convierte "HH:mm" a un DateTime de Prisma para una columna `time` (sin zona horaria: es solo la hora del dia). */
export function horaATime(hhmm: string): Date {
  const [horas, minutos] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, horas, minutos ?? 0));
}

/** Lee una columna `time` de Prisma y la muestra en 12 h ("7 pm"). Solo cambia como se muestra. */
export function timeAHora(fecha: Date): string {
  return horaDeTime(fecha);
}

/** "YYYY-MM-DD" que existe en el calendario (rechaza 2026-02-31 y 2026-13-45). */
export function esFechaISOReal(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

function exigirFechaReal(fechaISO: string) {
  if (!esFechaISOReal(fechaISO)) throw new ErrorDeNegocio("La fecha no es válida");
}

/** "2026-10-05" (America/Lima, sin hora) -> 23:59 hora Lima, como instante UTC. */
export function finDeDiaLimaAUtc(fechaISO: string): Date {
  exigirFechaReal(fechaISO);
  return new Date(`${fechaISO}T23:59:00-05:00`);
}

/** "2026-10-05" (America/Lima, sin hora) -> 00:00 hora Lima, como instante UTC. */
export function inicioDeDiaLimaAUtc(fechaISO: string): Date {
  exigirFechaReal(fechaISO);
  return new Date(`${fechaISO}T00:00:00-05:00`);
}

/** Fecha en lenguaje natural relativo a hoy ("Hoy", "Mar 24", "Mar 24 nov"). Ver src/lib/formato-fecha.ts. */
export function formatearFechaLima(fecha: Date): string {
  return fechaCorta(fecha);
}

/** "3 pm" en America/Lima. */
export function horaLima(fecha: Date): string {
  return hora(fecha);
}

/** "Mar 24 nov, 11:59 pm" (relativo a hoy). */
export function formatearFechaHoraLima(fecha: Date): string {
  return fechaCorta(fecha, { conHora: true });
}

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

/** "45 min", "7 h 20 min", "2 d 3 h". Desde 1 dia se omiten los minutos. */
export function formatearDuracion(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MINUTO_MS)) * MINUTO_MS;
  if (total < MINUTO_MS) return "menos de 1 min";
  if (total < HORA_MS) return `${total / MINUTO_MS} min`;
  if (total < DIA_MS) {
    const horas = Math.floor(total / HORA_MS);
    const minutos = (total % HORA_MS) / MINUTO_MS;
    return minutos ? `${horas} h ${minutos} min` : `${horas} h`;
  }
  const dias = Math.floor(total / DIA_MS);
  const horas = Math.floor((total % DIA_MS) / HORA_MS);
  return horas ? `${dias} d ${horas} h` : `${dias} d`;
}

export const DIAS_SEMANA = [
  { valor: 1, nombre: "Lunes" },
  { valor: 2, nombre: "Martes" },
  { valor: 3, nombre: "Miercoles" },
  { valor: 4, nombre: "Jueves" },
  { valor: 5, nombre: "Viernes" },
  { valor: 6, nombre: "Sabado" },
  { valor: 7, nombre: "Domingo" },
] as const;

/** Los cursos no dictan clase en domingo: horario_curso solo usa 1-6 (bloque_ocupado si usa 1-7). */
export const DIAS_SEMANA_CURSO = DIAS_SEMANA.filter((dia) => dia.valor !== 7);
