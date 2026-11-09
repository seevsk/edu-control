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
  pendiente: "var(--color-estado-pendiente)",
  en_progreso: "var(--color-estado-progreso)",
  en_revision: "var(--color-estado-revision)",
  completada: "var(--color-estado-completada)",
  descartada: "var(--color-text-muted)",
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
  if (estado === "en_progreso" && esAsignado) {
    acciones.push({ estado: "en_revision", etiqueta: "Enviar a revisión" });
  }
  if (estado === "en_revision" && !esAsignado) {
    acciones.push(
      { estado: "completada", etiqueta: "Aprobar y completar" },
      { estado: "en_progreso", etiqueta: "Devolver a progreso", motivo: "devolver" },
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
