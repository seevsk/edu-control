export const ESTADOS_TAREA_ORDEN = ["pendiente", "en_progreso", "en_revision", "completada"] as const;

export const ETIQUETA_ESTADO_TAREA: Record<string, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  en_revision: "En revision",
  completada: "Completada",
};

export const COLOR_ESTADO_TAREA: Record<string, string> = {
  pendiente: "var(--color-estado-pendiente)",
  en_progreso: "var(--color-estado-progreso)",
  en_revision: "var(--color-estado-revision)",
  completada: "var(--color-estado-completada)",
};
