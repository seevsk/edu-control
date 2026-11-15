/** Tipos compartidos entre la página del calendario (servidor) y la vista interactiva (cliente). */

export type FiltroCalendario = "clases" | "laboral" | "familiar" | "personal" | "tareas" | "evaluaciones" | "reuniones";

export const FILTROS_HORARIO: { clave: FiltroCalendario; texto: string; color: string }[] = [
  { clave: "clases", texto: "Clases", color: "var(--curso-0)" },
  { clave: "laboral", texto: "Laboral", color: "var(--cat-laboral)" },
  { clave: "familiar", texto: "Familiar", color: "var(--cat-fam)" },
  { clave: "personal", texto: "Personal", color: "var(--cal-personal)" },
];

export const FILTROS_FECHAS: { clave: FiltroCalendario; texto: string; color: string }[] = [
  { clave: "tareas", texto: "Tareas", color: "var(--cal-tarea)" },
  { clave: "evaluaciones", texto: "Evaluaciones", color: "var(--cal-evaluacion)" },
  { clave: "reuniones", texto: "Reuniones", color: "var(--cal-reunion)" },
];

export type IconoLinea = "hora" | "repite" | "lugar" | "evaluacion" | "grupo" | "estado";

/** Lo que muestra el popover de un evento: nunca datos que el usuario no pueda ver. */
export interface DatoEvento {
  filtro: FiltroCalendario;
  /** Segunda línea de la ficha ("11 am – 2:50 pm · Presencial"). */
  subtitulo: string;
  lineas: { icono: IconoLinea; texto: string }[];
  acciones: { texto: string; href: string; principal?: boolean }[];
  /** Ventana semanal (clases y bloques): sirve para avisar choques al crear tiempo ocupado. */
  semanal?: { diaSemana: number; inicioMin: number; finMin: number };
}

export type ModoCalendario = "mes" | "semana" | "agenda";
