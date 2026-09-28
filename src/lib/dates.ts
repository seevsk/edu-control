const ZONA_LIMA = "America/Lima";

/** Convierte "HH:mm" a un DateTime de Prisma para una columna `time` (sin zona horaria: es solo la hora del dia). */
export function horaATime(hhmm: string): Date {
  const [horas, minutos] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, horas, minutos ?? 0));
}

/** Lee una columna `time` de Prisma y la formatea como "HH:mm" (24h). */
export function timeAHora(fecha: Date): string {
  const horas = fecha.getUTCHours().toString().padStart(2, "0");
  const minutos = fecha.getUTCMinutes().toString().padStart(2, "0");
  return `${horas}:${minutos}`;
}

/** "2026-10-05" (America/Lima, sin hora) -> 23:59 hora Lima, como instante UTC. */
export function finDeDiaLimaAUtc(fechaISO: string): Date {
  return new Date(`${fechaISO}T23:59:00-05:00`);
}

/** "2026-10-05" (America/Lima, sin hora) -> 00:00 hora Lima, como instante UTC. */
export function inicioDeDiaLimaAUtc(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00-05:00`);
}

export function formatearFechaLima(fecha: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: ZONA_LIMA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha);
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
