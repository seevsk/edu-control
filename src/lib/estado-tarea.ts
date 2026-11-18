export const ESTADOS_TAREA_ORDEN = ["pendiente", "en_progreso", "en_revision", "completada"] as const;

/** Estados en los que la tarea todavia requiere trabajo; `descartada` y `completada` estan cerradas. */
export const ESTADOS_TAREA_ABIERTOS = ["pendiente", "en_progreso", "en_revision"] as const;

export type EstadoTarea = (typeof ESTADOS_TAREA_ORDEN)[number] | "descartada";

export function estaAbierta(estado: string): boolean {
  return (ESTADOS_TAREA_ABIERTOS as readonly string[]).includes(estado);
}

export const ETIQUETA_ESTADO_TAREA: Record<string, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  en_revision: "En revisión",
  completada: "Completada",
  descartada: "Descartada",
};

export const COLOR_ESTADO_TAREA: Record<string, string> = {
  pendiente: "var(--estado-pendiente)",
  en_progreso: "var(--estado-en-progreso)",
  en_revision: "var(--estado-en-revision)",
  completada: "var(--estado-completada)",
  descartada: "var(--muted-foreground)",
};

/** Acciones que requieren escribir un motivo (quedan en el historial). */
export type AccionConMotivo = "devolver" | "descartar" | "reabrir";

export interface AccionTarea {
  estado: EstadoTarea;
  etiqueta: string;
  motivo?: AccionConMotivo;
  /** Acciones de gestion del lider: solo se muestran en el detalle de la tarea. */
  gestion?: boolean;
}

export function accionesDisponiblesTarea({
  estado,
  idAsignado,
  idUsuario,
  rol,
}: {
  estado: EstadoTarea;
  idAsignado: number | null;
  idUsuario: number;
  rol: "lider" | "miembro" | "observador";
}): AccionTarea[] {
  if (rol === "observador") return [];
  const esAsignado = idAsignado === idUsuario;
  const esLider = rol === "lider";
  const acciones: AccionTarea[] = [];

  if (estado === "pendiente" && idAsignado !== null && (esAsignado || esLider)) {
    acciones.push({ estado: "en_progreso", etiqueta: "Empezar tarea" });
  }
  // Pasar a revision ya no es un cambio de estado suelto: exige una entrega (ver `enviarEntrega`).
  // Revisar es solo del lider, tambien cuando la tarea es suya.
  if (estado === "en_revision" && esLider) {
    acciones.push(
      { estado: "completada", etiqueta: "Aprobar" },
      { estado: "en_progreso", etiqueta: "Devolver", motivo: "devolver" },
    );
  }
  if (esLider && estaAbierta(estado)) {
    acciones.push({ estado: "descartada", etiqueta: "Descartar tarea", motivo: "descartar", gestion: true });
  }
  if (esLider && estado === "completada" && idAsignado !== null) {
    acciones.push({ estado: "en_progreso", etiqueta: "Reabrir tarea", motivo: "reabrir", gestion: true });
  }
  if (esLider && estado === "descartada") {
    acciones.push({ estado: "pendiente", etiqueta: "Restaurar tarea", gestion: true });
  }
  return acciones;
}
