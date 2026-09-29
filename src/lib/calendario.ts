/**
 * Helpers puros para la vista semanal del calendario (America/Lima). El calendario es una
 * vista, no una tabla: nada de esto se guarda (AGENTS.md 8.2).
 */
const ZONA = "America/Lima";

export const HORA_INICIO_GRID = 6; // 06:00
export const HORA_FIN_GRID = 23; // 23:00

function fechaLimaISO(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    fecha,
  );
}

/** "2026-10-01" (cualquier dia) -> "2026-09-28" (el lunes de esa semana, en Lima). */
export function lunesDeSemanaISO(fecha: Date): string {
  const [y, m, d] = fechaLimaISO(fecha).split("-").map(Number);
  const alMediodia = new Date(Date.UTC(y, m - 1, d, 12));
  const diaIso = alMediodia.getUTCDay() === 0 ? 7 : alMediodia.getUTCDay(); // 1=lunes...7=domingo
  alMediodia.setUTCDate(alMediodia.getUTCDate() - (diaIso - 1));
  return fechaLimaISO(alMediodia);
}

export function sumarDiasISO(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return fechaLimaISO(new Date(Date.UTC(y, m - 1, d + dias, 12)));
}

/** Los 7 dias (ISO, Lima) de la semana que empieza en `lunesISO`. */
export function diasDeLaSemana(lunesISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDiasISO(lunesISO, i));
}

export function fechaEnZonaLimaISO(fecha: Date): string {
  return fechaLimaISO(fecha);
}

function minutosDesdeMedianoche(fecha: Date): number {
  return fecha.getUTCHours() * 60 + fecha.getUTCMinutes();
}

/**
 * Un horario/bloque semanal (dia + hora inicio/fin) puede ocupar uno o dos segmentos de dia:
 * si cruza la medianoche, se dibuja hasta las 24:00 del dia y desde las 00:00 del siguiente.
 */
export function segmentosDelBloque(diaSemana: number, horaInicio: Date, horaFin: Date) {
  const inicioMin = minutosDesdeMedianoche(horaInicio);
  const finMin = minutosDesdeMedianoche(horaFin);

  if (finMin > inicioMin) {
    return [{ diaSemana, inicioMin, finMin }];
  }

  const diaSiguiente = diaSemana === 7 ? 1 : diaSemana + 1;
  return [
    { diaSemana, inicioMin, finMin: 24 * 60 },
    { diaSemana: diaSiguiente, inicioMin: 0, finMin },
  ];
}

/** Posicion (0-100%) de un segmento dentro del rango visible del grid. null si cae fuera. */
export function posicionEnGrid(inicioMin: number, finMin: number) {
  const desde = HORA_INICIO_GRID * 60;
  const hasta = HORA_FIN_GRID * 60;
  const i = Math.max(inicioMin, desde);
  const f = Math.min(finMin, hasta);
  if (f <= i) return null;

  return {
    topPct: ((i - desde) / (hasta - desde)) * 100,
    heightPct: ((f - i) / (hasta - desde)) * 100,
  };
}

