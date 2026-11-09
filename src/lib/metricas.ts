/**
 * Reglas de calculo de AGENTS.md 8.5, como funciones puras: nunca se guardan estas cifras.
 * Las tareas `descartada` quedan fuera de todas las metricas.
 */
import { evaluarEntrega, type EventoHistorialTiempo } from "@/lib/tiempos-tarea";

interface TareaParaMetrica {
  idTarea: number;
  peso: number;
  estado: string;
  idAsignado: number | null;
  fechaLimite: Date | null;
}

function vigentes<T extends TareaParaMetrica>(tareas: T[]): T[] {
  return tareas.filter((t) => t.estado !== "descartada");
}

/** null = "sin tareas" (no mostrar 0%). */
export function calcularAvanceGrupo(tareas: TareaParaMetrica[]): number | null {
  const consideradas = vigentes(tareas);
  const pesoTotal = consideradas.reduce((acc, t) => acc + t.peso, 0);
  if (pesoTotal === 0) return null;
  const pesoCompletado = consideradas
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
  const consideradas = vigentes(tareas);
  const pesoTotal = consideradas.reduce((acc, t) => acc + t.peso, 0);

  return idsIntegrantesElegibles.map((idUsuario) => {
    const asignadas = consideradas.filter((t) => t.idAsignado === idUsuario);
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

/**
 * La entrega se mide con la PRIMERA vez que la tarea paso a en_revision desde que se le asigno
 * (no con fecha_terminada, que se borra si la devuelven), contra la fecha limite vigente al
 * asignarla: ni la demora del revisor ni una reprogramacion posterior cambian el resultado.
 */
export function calcularPuntualidad(
  tareas: TareaParaMetrica[],
  historial: (EventoHistorialTiempo & { idTarea: number })[],
  idUsuario: number,
): number | null {
  let entregadas = 0;
  let aTiempo = 0;

  for (const tarea of vigentes(tareas)) {
    if (tarea.idAsignado !== idUsuario) continue;
    const entrega = evaluarEntrega(tarea, historial.filter((h) => h.idTarea === tarea.idTarea));
    if (!entrega || !entrega.fechaLimite) continue;
    entregadas++;
    if (entrega.aTiempo) aTiempo++;
  }

  return entregadas > 0 ? aTiempo / entregadas : null;
}
