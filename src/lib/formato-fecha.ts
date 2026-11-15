/**
 * Formato de fechas y horas de toda la interfaz (guia de rediseño §10): lenguaje natural, corto y
 * relativo a hoy, siempre en America/Lima. Funciones puras: `ahora` se puede inyectar para probarlas.
 */

const ZONA = "America/Lima";
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
/** En Perú se usa "set"; cambiar aquí si se prefiere "sep". */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
const DIA_MS = 86_400_000;

interface PartesLima {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  /** 1 = lunes ... 7 = domingo */
  diaSemana: number;
}

export function partesLima(fecha: Date): PartesLima {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  const semana = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(valor("weekday")) + 1;
  return {
    anio: Number(valor("year")),
    mes: Number(valor("month")),
    dia: Number(valor("day")),
    hora: Number(valor("hour")) % 24,
    minuto: Number(valor("minute")),
    diaSemana: semana,
  };
}

/** Numero de dia calendario en Lima (para comparar dias sin horas). */
function diaAbsoluto(partes: PartesLima): number {
  return Date.UTC(partes.anio, partes.mes - 1, partes.dia) / DIA_MS;
}

/** "9 am", "2:50 pm", "12 pm". */
export function formatoHora(horas: number, minutos: number): string {
  const sufijo = horas < 12 ? "am" : "pm";
  const hora12 = horas % 12 === 0 ? 12 : horas % 12;
  return minutos ? `${hora12}:${String(minutos).padStart(2, "0")} ${sufijo}` : `${hora12} ${sufijo}`;
}

export function hora(fecha: Date): string {
  const partes = partesLima(fecha);
  return formatoHora(partes.hora, partes.minuto);
}

/** Columna `time` de Prisma (sin zona): "11 am". */
export function horaDeTime(time: Date): string {
  return formatoHora(time.getUTCHours(), time.getUTCMinutes());
}

/** "9 – 10:50 am", "11 am – 2:50 pm": el sufijo va una sola vez si coincide. */
export function rangoHoras(inicio: { horas: number; minutos: number }, fin: { horas: number; minutos: number }): string {
  const desde = formatoHora(inicio.horas, inicio.minutos);
  const hasta = formatoHora(fin.horas, fin.minutos);
  const mismoSufijo = (inicio.horas < 12) === (fin.horas < 12);
  return mismoSufijo ? `${desde.replace(/ (am|pm)$/, "")} – ${hasta}` : `${desde} – ${hasta}`;
}

/** Inicio (lunes) de la semana de `partes`, como dia absoluto. */
function lunesDe(partes: PartesLima): number {
  return diaAbsoluto(partes) - (partes.diaSemana - 1);
}

/**
 * "Hoy", "Ayer", "Mañana", "Lun 9" (semana actual o siguiente), "Mar 24 nov" (este año) o
 * "Lun 5 nov 2025". Con `conHora`, agrega ", 11:59 pm".
 */
export function fechaCorta(fecha: Date, opciones: { ahora?: Date; conHora?: boolean } = {}): string {
  const ahora = opciones.ahora ?? new Date();
  const p = partesLima(fecha);
  const hoy = partesLima(ahora);
  const diferencia = diaAbsoluto(p) - diaAbsoluto(hoy);
  let texto: string;
  if (diferencia === 0) texto = "Hoy";
  else if (diferencia === -1) texto = "Ayer";
  else if (diferencia === 1) texto = "Mañana";
  else {
    const semanas = (lunesDe(p) - lunesDe(hoy)) / 7;
    if (semanas === 0 || semanas === 1) texto = `${DIAS[p.diaSemana - 1]} ${p.dia}`;
    else if (p.anio === hoy.anio) texto = `${DIAS[p.diaSemana - 1]} ${p.dia} ${MESES[p.mes - 1]}`;
    else texto = `${DIAS[p.diaSemana - 1]} ${p.dia} ${MESES[p.mes - 1]} ${p.anio}`;
  }
  return opciones.conHora ? `${texto}, ${formatoHora(p.hora, p.minuto)}` : texto;
}

/** "24 nov" (o "24 nov 2025" si es de otro año), sin dia de la semana. */
export function diaYMes(fecha: Date, ahora = new Date()): string {
  const p = partesLima(fecha);
  return p.anio === partesLima(ahora).anio ? `${p.dia} ${MESES[p.mes - 1]}` : `${p.dia} ${MESES[p.mes - 1]} ${p.anio}`;
}

/** Complemento en muted: "en 9 días", "hace 31 días", "hoy", "mañana", "ayer". */
export function distancia(fecha: Date, ahora = new Date()): string {
  const dias = diaAbsoluto(partesLima(fecha)) - diaAbsoluto(partesLima(ahora));
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  return dias > 0 ? `en ${dias} días` : `hace ${-dias} días`;
}

/** Timestamp de actividad: "hace 5 min", "9:40 am" (hoy), "Lun 9" (esta semana), "10 oct". */
export function marcaActividad(fecha: Date, ahora = new Date()): string {
  const minutos = Math.floor((ahora.getTime() - fecha.getTime()) / 60_000);
  if (minutos >= 0 && minutos < 1) return "ahora";
  if (minutos >= 0 && minutos < 60) return `hace ${minutos} min`;
  const p = partesLima(fecha);
  const hoy = partesLima(ahora);
  if (diaAbsoluto(p) === diaAbsoluto(hoy)) return formatoHora(p.hora, p.minuto);
  if (lunesDe(p) === lunesDe(hoy)) return `${DIAS[p.diaSemana - 1]} ${p.dia}`;
  return diaYMes(fecha, ahora);
}

/** "oct 2026". */
export function mesAnio(fecha: Date): string {
  const p = partesLima(fecha);
  return `${MESES[p.mes - 1]} ${p.anio}`;
}

/** Fecha absoluta completa para tooltips y lectores: "martes 24 de noviembre de 2026, 11:59 pm". */
export function fechaCompleta(fecha: Date): string {
  const p = partesLima(fecha);
  return `${DIAS_LARGOS[p.diaSemana - 1]} ${p.dia} de ${MESES_LARGOS[p.mes - 1]} de ${p.anio}, ${formatoHora(p.hora, p.minuto)}`;
}

/** "9 – 15 nov 2026" o "28 oct – 3 nov 2026". */
export function rangoDias(desde: Date, hasta: Date): string {
  const a = partesLima(desde);
  const b = partesLima(hasta);
  if (a.anio !== b.anio) return `${a.dia} ${MESES[a.mes - 1]} ${a.anio} – ${b.dia} ${MESES[b.mes - 1]} ${b.anio}`;
  if (a.mes !== b.mes) return `${a.dia} ${MESES[a.mes - 1]} – ${b.dia} ${MESES[b.mes - 1]} ${b.anio}`;
  return `${a.dia} – ${b.dia} ${MESES[b.mes - 1]} ${b.anio}`;
}

/** Duracion de una sesion: "1 h 50 min", "2 h", "45 min". */
export function duracionMinutos(total: number): string {
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  if (!horas) return `${minutos} min`;
  return minutos ? `${horas} h ${minutos} min` : `${horas} h`;
}
