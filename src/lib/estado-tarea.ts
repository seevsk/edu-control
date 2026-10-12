export const ESTADOS_TAREA_ORDEN = ["pendiente", "en_progreso", "en_revision", "completada"] as const;

export const ETIQUETA_ESTADO_TAREA: Record<string, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  en_revision: "En revisión",
  completada: "Completada",
};

export const COLOR_ESTADO_TAREA: Record<string, string> = {
  pendiente: "var(--color-estado-pendiente)",
  en_progreso: "var(--color-estado-progreso)",
  en_revision: "var(--color-estado-revision)",
  completada: "var(--color-estado-completada)",
};

export function accionesDisponiblesTarea({
  estado,
  idAsignado,
  idUsuario,
  rol,
}: {
  estado: (typeof ESTADOS_TAREA_ORDEN)[number];
  idAsignado: number | null;
  idUsuario: number;
  rol: "lider" | "miembro" | "observador";
}): { estado: (typeof ESTADOS_TAREA_ORDEN)[number]; etiqueta: string }[] {
  if (rol === "observador") return [];
  const esAsignado = idAsignado === idUsuario;
  if (estado === "pendiente" && (esAsignado || rol === "lider")) {
    return [{ estado: "en_progreso", etiqueta: "Empezar tarea" }];
  }
  if (estado === "en_progreso" && esAsignado) {
    return [{ estado: "en_revision", etiqueta: "Enviar a revisión" }];
  }
  if (estado === "en_revision" && !esAsignado) {
    return [
      { estado: "completada", etiqueta: "Aprobar y completar" },
      { estado: "en_progreso", etiqueta: "Devolver a progreso" },
    ];
  }
  return [];
}
