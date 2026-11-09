/**
 * Tracking de tiempos de una tarea, calculado desde `tarea_historial` (nunca se guarda).
 * Cada cambio de estado o de responsable cierra un tramo y abre otro. El reloj del asignado
 * solo corre en `en_progreso`; en `en_revision` queda pausado (es tiempo del revisor).
 */
import { estaAbierta } from "@/lib/estado-tarea";
import { leerValorEstadoHistorial } from "@/lib/tarea-historial";

export interface EventoHistorialTiempo {
  idHistorial: number;
  idUsuario: number;
  accion: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  fecha: Date;
}

export interface TareaParaTiempos {
  estado: string;
  idAsignado: number | null;
  fechaLimite: Date | null;
}

export interface Tramo {
  estado: string;
  idAsignado: number | null;
  desde: Date;
  hasta: Date;
  ms: number;
  /** El tramo sigue abierto: se mide hasta `ahora`. */
  enCurso: boolean;
}

export interface VistaAsignacion {
  idUsuario: number;
  asignadaEn: Date;
  vistaEn: Date | null;
}

export interface TiemposTarea {
  tramos: Tramo[];
  /** Tramo que cerro cada evento del historial (por id_historial). */
  tramoCerradoPor: Record<number, Tramo>;
  tramoActual: Tramo | null;
  sinAsignarMs: number;
  pendienteMs: number;
  enProgresoMs: number;
  enRevisionMs: number;
  totalMs: number;
  trabajoPorUsuario: Record<number, number>;
  vistas: VistaAsignacion[];
  devoluciones: number;
  reaperturas: number;
  reprogramaciones: number;
}

function ordenar(historial: EventoHistorialTiempo[]) {
  return [...historial].sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.idHistorial - b.idHistorial);
}

function aIdUsuario(valor: string | null): number | null {
  return valor === null ? null : Number(valor);
}

function aFecha(valor: string | null): Date | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Responsable con el que nacio la tarea: el "anterior" de la primera reasignacion, o el actual. */
function asignadoInicial(tarea: TareaParaTiempos, ordenado: EventoHistorialTiempo[]): number | null {
  const primera = ordenado.find((evento) => evento.accion === "reasignada");
  return primera ? aIdUsuario(primera.valorAnterior) : tarea.idAsignado;
}

export function calcularTiemposTarea(
  tarea: TareaParaTiempos,
  historial: EventoHistorialTiempo[],
  ahora = new Date(),
): TiemposTarea {
  const ordenado = ordenar(historial);
  const resultado: TiemposTarea = {
    tramos: [],
    tramoCerradoPor: {},
    tramoActual: null,
    sinAsignarMs: 0,
    pendienteMs: 0,
    enProgresoMs: 0,
    enRevisionMs: 0,
    totalMs: 0,
    trabajoPorUsuario: {},
    vistas: [],
    devoluciones: 0,
    reaperturas: 0,
    reprogramaciones: 0,
  };
  const creada = ordenado.find((evento) => evento.accion === "creada");
  if (!creada) return resultado;

  let estado = "pendiente";
  let asignado = asignadoInicial(tarea, ordenado);
  let inicio = creada.fecha;
  let fin: Date | null = null;
  if (asignado !== null) resultado.vistas.push({ idUsuario: asignado, asignadaEn: creada.fecha, vistaEn: null });

  function cerrarTramo(hasta: Date, enCurso: boolean): Tramo {
    const tramo: Tramo = { estado, idAsignado: asignado, desde: inicio, hasta, ms: Math.max(0, hasta.getTime() - inicio.getTime()), enCurso };
    resultado.tramos.push(tramo);
    if (estado === "en_revision") resultado.enRevisionMs += tramo.ms;
    else if (estaAbierta(estado) && asignado === null) resultado.sinAsignarMs += tramo.ms;
    else if (estado === "pendiente") resultado.pendienteMs += tramo.ms;
    else if (estado === "en_progreso" && asignado !== null) {
      resultado.enProgresoMs += tramo.ms;
      resultado.trabajoPorUsuario[asignado] = (resultado.trabajoPorUsuario[asignado] ?? 0) + tramo.ms;
    }
    inicio = hasta;
    return tramo;
  }

  for (const evento of ordenado) {
    if (evento === creada) continue;
    if (evento.accion === "estado") {
      const anterior = leerValorEstadoHistorial(evento.valorAnterior).estado;
      const nuevo = leerValorEstadoHistorial(evento.valorNuevo).estado ?? estado;
      resultado.tramoCerradoPor[evento.idHistorial] = cerrarTramo(evento.fecha, false);
      if (anterior === "en_revision" && nuevo === "en_progreso") resultado.devoluciones++;
      if (anterior === "completada" && estaAbierta(nuevo)) resultado.reaperturas++;
      estado = nuevo;
      fin = estaAbierta(estado) ? null : evento.fecha;
    } else if (evento.accion === "reasignada") {
      resultado.tramoCerradoPor[evento.idHistorial] = cerrarTramo(evento.fecha, false);
      asignado = aIdUsuario(evento.valorNuevo);
      if (asignado !== null) resultado.vistas.push({ idUsuario: asignado, asignadaEn: evento.fecha, vistaEn: null });
    } else if (evento.accion === "vista") {
      const vigente = resultado.vistas.at(-1);
      if (vigente && vigente.idUsuario === evento.idUsuario && vigente.vistaEn === null) vigente.vistaEn = evento.fecha;
    } else if (evento.accion === "fecha_limite") {
      resultado.reprogramaciones++;
    }
  }

  if (estaAbierta(estado)) resultado.tramoActual = cerrarTramo(ahora, true);
  resultado.totalMs = Math.max(0, (fin ?? ahora).getTime() - creada.fecha.getTime());
  return resultado;
}

/** Fecha limite con la que nacio la tarea, antes de cualquier reprogramacion. */
export function fechaLimiteOriginal(tarea: TareaParaTiempos, historial: EventoHistorialTiempo[]): Date | null {
  const primera = ordenar(historial).find((evento) => evento.accion === "fecha_limite");
  return primera ? aFecha(primera.valorAnterior) : tarea.fechaLimite;
}

/** Fecha limite que estaba vigente en un momento dado (reconstruida desde el historial). */
export function fechaLimiteVigenteAl(tarea: TareaParaTiempos, historial: EventoHistorialTiempo[], momento: Date): Date | null {
  let vigente = fechaLimiteOriginal(tarea, historial);
  for (const evento of ordenar(historial)) {
    if (evento.fecha > momento) break;
    if (evento.accion === "fecha_limite") vigente = aFecha(evento.valorNuevo);
  }
  return vigente;
}

/** Desde cuando la tiene el responsable actual: su ultima asignacion o, si nacio con el, la creacion. */
export function inicioAsignacionActual(tarea: TareaParaTiempos, historial: EventoHistorialTiempo[]): Date | null {
  if (tarea.idAsignado === null) return null;
  const ordenado = ordenar(historial);
  const ultima = ordenado.findLast(
    (evento) => evento.accion === "reasignada" && evento.valorNuevo === String(tarea.idAsignado),
  );
  return ultima?.fecha ?? ordenado.find((evento) => evento.accion === "creada")?.fecha ?? null;
}

/**
 * Entrega del responsable actual = primera vez que paso a en_revision desde que se le asigno.
 * Se compara con la fecha limite vigente al asignarla: reprogramar despues no borra el atraso.
 */
export function evaluarEntrega(
  tarea: TareaParaTiempos,
  historial: EventoHistorialTiempo[],
): { entregadaEn: Date; fechaLimite: Date | null; aTiempo: boolean } | null {
  const desde = inicioAsignacionActual(tarea, historial);
  if (!desde) return null;
  const entrega = ordenar(historial).find(
    (evento) =>
      evento.accion === "estado" &&
      evento.fecha >= desde &&
      leerValorEstadoHistorial(evento.valorNuevo).estado === "en_revision",
  );
  if (!entrega) return null;
  const fechaLimite = fechaLimiteVigenteAl(tarea, historial, desde);
  return { entregadaEn: entrega.fecha, fechaLimite, aTiempo: !fechaLimite || entrega.fecha <= fechaLimite };
}

/** Fecha en que la tarea quedo en su estado actual (ultimo cambio de estado). */
export function fechaEstadoActual(historial: EventoHistorialTiempo[]): Date | null {
  return ordenar(historial).findLast((evento) => evento.accion === "estado")?.fecha ?? null;
}

export function estaVencida(tarea: TareaParaTiempos, ahora = new Date()): boolean {
  return estaAbierta(tarea.estado) && tarea.fechaLimite !== null && tarea.fechaLimite < ahora;
}
