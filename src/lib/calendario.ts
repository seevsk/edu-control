/**
 * Helpers puros para la vista semanal del calendario (America/Lima). El calendario es una
 * vista, no una tabla: nada de esto se guarda (AGENTS.md 8.2).
 */
const ZONA = "America/Lima";

/**
 * "familiar" y "personal" son tipos distintos en bloque_ocupado, pero en el calendario se
 * muestran como una sola categoria (decision del usuario).
 */
export type CategoriaCalendario = "clases" | "laboral" | "fam";

export const CATEGORIAS_CALENDARIO: { key: CategoriaCalendario; label: string }[] = [
  { key: "clases", label: "Clases" },
  { key: "laboral", label: "Laboral" },
  { key: "fam", label: "Familiar / Personal" },
];

export const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DIAS_LARGOS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function categoriaDeTipoBloque(tipo: "laboral" | "familiar" | "personal"): CategoriaCalendario {
  return tipo === "laboral" ? "laboral" : "fam";
}

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

/** Minutos transcurridos del dia en Lima para un instante dado. */
export function minutosDelDiaLima(fecha: Date): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? 0);
  const minuto = Number(partes.find((p) => p.type === "minute")?.value ?? 0);
  return hora * 60 + minuto;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-09-28" -> "28 sep". */
export function diaMesCorto(fechaISO: string): string {
  const [, m, d] = fechaISO.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}

const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * "Desde el 5 hasta el 11 de octubre" / "Desde el 28 de septiembre hasta el 4 de octubre".
 * El año solo aparece si no es el año en curso.
 */
export function etiquetaSemana(lunesISO: string, anioActual: number): string {
  const domingoISO = sumarDiasISO(lunesISO, 6);
  const [anioInicio, mesInicio, diaInicio] = lunesISO.split("-").map(Number);
  const [anioFin, mesFin, diaFin] = domingoISO.split("-").map(Number);
  const conAnio = (anio: number) => (anio !== anioActual ? ` de ${anio}` : "");

  const fin = `${diaFin} de ${MESES_LARGOS[mesFin - 1]}${conAnio(anioFin)}`;
  if (mesInicio === mesFin) return `Desde el ${diaInicio} hasta el ${fin}`;
  const inicio = `${diaInicio} de ${MESES_LARGOS[mesInicio - 1]}${anioInicio !== anioFin ? conAnio(anioInicio) : ""}`;
  return `Desde el ${inicio} hasta el ${fin}`;
}

/** "2026-10-05" -> 1 (lunes) ... 7 (domingo). */
export function diaSemanaISO(fechaISO: string): number {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return dia === 0 ? 7 : dia;
}

/** "2026-10-07" -> "Miércoles 7 de octubre". */
export function etiquetaFechaLarga(fechaISO: string): string {
  const [, m, d] = fechaISO.split("-").map(Number);
  return `${DIAS_LARGOS[diaSemanaISO(fechaISO) - 1]} ${d} de ${MESES_LARGOS[m - 1]}`;
}

/** Proxima fecha (hoy incluido) que cae en `diaSemana`, para programar desde un patron semanal. */
export function proximaFechaDelDia(hoyISO: string, diaSemana: number): string {
  return sumarDiasISO(hoyISO, (diaSemana - diaSemanaISO(hoyISO) + 7) % 7);
}

function minutosDesdeMedianoche(fecha: Date): number {
  return fecha.getUTCHours() * 60 + fecha.getUTCMinutes();
}

/**
 * Partes de un horario/bloque semanal por dia. Si cruza la medianoche (turno nocturno) se
 * corta a las 12 AM y sigue en el dia siguiente: la primera parte conserva la hora real de
 * inicio y la segunda la hora real de fin.
 */
export function partesPorDia(diaSemana: number, horaInicio: Date, horaFin: Date) {
  const inicioMin = minutosDesdeMedianoche(horaInicio);
  const finMin = minutosDesdeMedianoche(horaFin);

  if (finMin > inicioMin) {
    return [{ diaSemana, inicioMin, finMin, sigueDelDiaAnterior: false, sigueAlDiaSiguiente: false }];
  }

  return [
    { diaSemana, inicioMin, finMin: 24 * 60, sigueDelDiaAnterior: false, sigueAlDiaSiguiente: true },
    {
      diaSemana: diaSemana === 7 ? 1 : diaSemana + 1,
      inicioMin: 0,
      finMin,
      sigueDelDiaAnterior: true,
      sigueAlDiaSiguiente: false,
    },
  ];
}

/** Minutos desde medianoche -> etiqueta 12h ("6:00 AM", "1:30 PM"). */
export function etiquetaMinutos(min: number): string {
  const horas24 = Math.floor(min / 60) % 24;
  const minutos = min % 60;
  const sufijo = horas24 < 12 ? "AM" : "PM";
  const horas12 = horas24 % 12 === 0 ? 12 : horas24 % 12;
  return `${horas12}:${minutos.toString().padStart(2, "0")} ${sufijo}`;
}

/** Etiqueta corta para el eje de horas ("6 AM", "12 PM"). */
export function etiquetaHoraEje(hora24: number): string {
  const sufijo = hora24 % 24 < 12 ? "AM" : "PM";
  const horas12 = hora24 % 12 === 0 ? 12 : hora24 % 12;
  return `${horas12} ${sufijo}`;
}

/** 90 -> "1 h 30 min"; 600 -> "10 h"; 45 -> "45 min". */
export function formatearDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/** Opciones de hora cada 30 minutos: valor "HH:mm" (lo que valida el servidor), etiqueta en 12h. */
export const OPCIONES_HORA = Array.from({ length: 48 }, (_, i) => {
  const min = i * 30;
  const valor = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  return { valor, etiqueta: etiquetaMinutos(min) };
});

/**
 * Primera hora visible del grid (que siempre llega a las 12 AM): la de la parte que empieza
 * mas temprano. Con un turno nocturno, su segunda parte arranca a las 12 AM y el grid
 * empieza ahi, para que nunca se esconda. Sin bloques: 7 AM.
 */
export function horaInicioVisible(items: { inicioMin: number }[]): number {
  if (items.length === 0) return 7;
  return Math.min(...items.map((item) => Math.floor(item.inicioMin / 60)));
}

export type ConColumna<T> = T & { columna: number; columnas: number };

/**
 * Reparte los items de un dia en columnas cuando se solapan (como en cualquier calendario):
 * los que no chocan con nadie usan todo el ancho; los que chocan se dividen el espacio.
 */
export function distribuirSolapes<T extends { inicioMin: number; finMin: number }>(items: T[]): ConColumna<T>[] {
  const ordenados = [...items].sort((a, b) => a.inicioMin - b.inicioMin || b.finMin - a.finMin);
  const resultado: ConColumna<T>[] = [];
  let grupo: ConColumna<T>[] = [];
  let finesPorColumna: number[] = [];
  let finDelGrupo = -1;

  const cerrarGrupo = () => {
    for (const item of grupo) item.columnas = finesPorColumna.length;
    grupo = [];
    finesPorColumna = [];
  };

  for (const item of ordenados) {
    if (item.inicioMin >= finDelGrupo) cerrarGrupo();

    let columna = finesPorColumna.findIndex((fin) => fin <= item.inicioMin);
    if (columna === -1) {
      columna = finesPorColumna.length;
      finesPorColumna.push(item.finMin);
    } else {
      finesPorColumna[columna] = item.finMin;
    }

    const conColumna = { ...item, columna, columnas: 1 } as ConColumna<T>;
    grupo.push(conColumna);
    resultado.push(conColumna);
    finDelGrupo = grupo.length === 1 ? item.finMin : Math.max(finDelGrupo, item.finMin);
  }
  cerrarGrupo();

  return resultado;
}
