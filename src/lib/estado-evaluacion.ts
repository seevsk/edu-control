/**
 * Avance personal de una evaluacion (AGENTS.md 8.2): mismos criterios que las tareas de grupo, pero
 * lo maneja solo el dueno del curso. Funciones puras para poder probarlas.
 */
export const ESTADOS_EVALUACION = ["pendiente", "en_progreso", "completada", "descartada"] as const;
export type EstadoEvaluacion = (typeof ESTADOS_EVALUACION)[number];

export const ETIQUETA_ESTADO_EVALUACION: Record<EstadoEvaluacion, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Terminada",
  descartada: "Descartada",
};

export function evaluacionAbierta(estado: EstadoEvaluacion): boolean {
  return estado === "pendiente" || estado === "en_progreso";
}

export interface AccionEvaluacion {
  destino: EstadoEvaluacion;
  etiqueta: string;
  /** Descartar exige escribir un motivo; queda en el historial. */
  conMotivo?: boolean;
  /** Si no se puede ejecutar aun, el porque (se muestra deshabilitada). */
  bloqueada?: string;
}

/**
 * Transiciones permitidas:
 * pendiente -> en_progreso -> completada (si requiere entrega, primero hay que marcarla entregada),
 * abierta -> descartada (con motivo), descartada -> pendiente (restaurar), completada -> en_progreso (reabrir).
 */
export function accionesEvaluacion(evaluacion: { estado: EstadoEvaluacion; requiereEntrega: boolean; fechaEntrega: Date | null }): AccionEvaluacion[] {
  const faltaEntrega = evaluacion.requiereEntrega && !evaluacion.fechaEntrega;
  switch (evaluacion.estado) {
    case "pendiente":
      return [
        { destino: "en_progreso", etiqueta: "Empezar" },
        { destino: "descartada", etiqueta: "Descartar", conMotivo: true },
      ];
    case "en_progreso":
      return [
        { destino: "completada", etiqueta: "Terminar", bloqueada: faltaEntrega ? "Marca la entrega antes de terminar" : undefined },
        { destino: "descartada", etiqueta: "Descartar", conMotivo: true },
      ];
    case "completada":
      return [{ destino: "en_progreso", etiqueta: "Reabrir" }];
    case "descartada":
      return [{ destino: "pendiente", etiqueta: "Restaurar" }];
  }
}

export function transicionEvaluacionValida(
  evaluacion: { estado: EstadoEvaluacion; requiereEntrega: boolean; fechaEntrega: Date | null },
  destino: EstadoEvaluacion,
): { ok: true; conMotivo: boolean } | { ok: false; mensaje: string } {
  const accion = accionesEvaluacion(evaluacion).find((candidata) => candidata.destino === destino);
  if (!accion) return { ok: false, mensaje: "Ese cambio de estado no está permitido" };
  if (accion.bloqueada) return { ok: false, mensaje: accion.bloqueada };
  return { ok: true, conMotivo: accion.conMotivo === true };
}

const SEPARADOR_MOTIVO = "\n\nMotivo de descarte: ";

export function valorConMotivo(estado: EstadoEvaluacion, motivo: string): string {
  return `${estado}${SEPARADOR_MOTIVO}${motivo}`;
}

export function leerValorEvaluacion(valor: string | null): { estado: string | null; motivo: string | null } {
  if (!valor) return { estado: valor, motivo: null };
  const indice = valor.indexOf(SEPARADOR_MOTIVO);
  if (indice === -1) return { estado: valor, motivo: null };
  return { estado: valor.slice(0, indice), motivo: valor.slice(indice + SEPARADOR_MOTIVO.length) };
}

export function describirHistorialEvaluacion(entrada: { accion: "creada" | "vista" | "estado" | "entrega"; valorAnterior: string | null; valorNuevo: string | null }): string {
  if (entrada.accion === "creada") return "Registraste la evaluación";
  if (entrada.accion === "vista") return "La viste por primera vez";
  if (entrada.accion === "entrega") return entrada.valorNuevo === "entregada" ? "Marcaste la entrega" : "Quitaste la marca de entrega";
  const { estado } = leerValorEvaluacion(entrada.valorNuevo);
  const anterior = entrada.valorAnterior;
  if (estado === "en_progreso" && anterior === "completada") return "Reabriste la evaluación";
  if (estado === "pendiente" && anterior === "descartada") return "Restauraste la evaluación";
  if (estado === "en_progreso") return "Empezaste a trabajar en ella";
  if (estado === "completada") return "La terminaste";
  if (estado === "descartada") return "La descartaste";
  return `Cambiaste el estado a ${ETIQUETA_ESTADO_EVALUACION[estado as EstadoEvaluacion] ?? estado}`;
}
