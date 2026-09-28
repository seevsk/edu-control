/**
 * Reglas de calculo de AGENTS.md 8.5, como funciones puras: nunca se guardan estas cifras.
 */

interface TareaParaMetrica {
  idTarea: number;
  peso: number;
  estado: string;
  idAsignado: number | null;
  fechaLimite: Date | null;
}

/** null = "sin tareas" (no mostrar 0%). */
export function calcularAvanceGrupo(tareas: TareaParaMetrica[]): number | null {
  const pesoTotal = tareas.reduce((acc, t) => acc + t.peso, 0);
  if (pesoTotal === 0) return null;
  const pesoCompletado = tareas
    .filter((t) => t.estado === "completada")
    .reduce((acc, t) => acc + t.peso, 0);
  return pesoCompletado / pesoTotal;
}

export interface MetricaIntegrante {
  idUsuario: number;
  carga: number;
  cumplimiento: number | null;
}

export function calcularMetricasPorIntegrante(
  tareas: TareaParaMetrica[],
  idsIntegrantesElegibles: number[],
): MetricaIntegrante[] {
  const pesoTotal = tareas.reduce((acc, t) => acc + t.peso, 0);

  return idsIntegrantesElegibles.map((idUsuario) => {
    const asignadas = tareas.filter((t) => t.idAsignado === idUsuario);
    const pesoAsignado = asignadas.reduce((acc, t) => acc + t.peso, 0);
    const pesoCompletado = asignadas
      .filter((t) => t.estado === "completada")
      .reduce((acc, t) => acc + t.peso, 0);

    return {
      idUsuario,
      carga: pesoTotal > 0 ? pesoAsignado / pesoTotal : 0,
      cumplimiento: pesoAsignado > 0 ? pesoCompletado / pesoAsignado : null,
    };
  });
}

interface EntradaHistorialParaPuntualidad {
  idTarea: number;
  accion: string;
  valorNuevo: string | null;
  fecha: Date;
}

/**
 * La entrega se mide con la PRIMERA vez que la tarea paso a en_revision (no con fecha_terminada,
 * que se borra si la devuelven), para no penalizar al asignado si el revisor tarda.
 */
export function calcularPuntualidad(
  tareas: TareaParaMetrica[],
  historial: EntradaHistorialParaPuntualidad[],
  idUsuario: number,
): number | null {
  const tareasConFechaLimite = tareas.filter((t) => t.idAsignado === idUsuario && t.fechaLimite);

  let entregadas = 0;
  let aTiempo = 0;

  for (const tarea of tareasConFechaLimite) {
    const primeraRevision = historial
      .filter((h) => h.idTarea === tarea.idTarea && h.accion === "estado" && h.valorNuevo === "en_revision")
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())[0];

    if (!primeraRevision) continue;
    entregadas++;
    if (primeraRevision.fecha <= tarea.fechaLimite!) aTiempo++;
  }

  return entregadas > 0 ? aTiempo / entregadas : null;
}
