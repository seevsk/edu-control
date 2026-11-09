import { ETIQUETA_ESTADO_TAREA, type AccionConMotivo } from "@/lib/estado-tarea";
import { formatearFechaLima } from "@/lib/dates";

/** El motivo viaja dentro de `valor_nuevo`, separado del estado; cada accion tiene su propio rotulo. */
const SEPARADORES_MOTIVO: Record<AccionConMotivo, string> = {
  devolver: "\n\nMotivo de devolución: ",
  descartar: "\n\nMotivo de descarte: ",
  reabrir: "\n\nMotivo de reapertura: ",
};

export function valorHistorialConMotivo(estado: string, accion: AccionConMotivo, motivo: string): string {
  return `${estado}${SEPARADORES_MOTIVO[accion]}${motivo}`;
}

export function leerValorEstadoHistorial(valor: string | null): { estado: string | null; motivo: string | null } {
  if (!valor) return { estado: valor, motivo: null };
  for (const separador of Object.values(SEPARADORES_MOTIVO)) {
    const indice = valor.indexOf(separador);
    if (indice !== -1) {
      return { estado: valor.slice(0, indice), motivo: valor.slice(indice + separador.length) };
    }
  }
  return { estado: valor, motivo: null };
}

export interface EntradaHistorialTarea {
  idHistorial: number;
  accion: "creada" | "estado" | "reasignada" | "vista" | "fecha_limite" | "peso";
  valorAnterior: string | null;
  valorNuevo: string | null;
  fecha: Date;
  usuario: { nombre: string; apellidos: string | null };
  tarea?: { idTarea: number; titulo: string };
}

function fechaHistorial(valor: string | null): string {
  if (!valor) return "sin fecha";
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : formatearFechaLima(fecha);
}

/** Texto corto del cambio de estado, segun el par anterior -> nuevo. */
export function describirCambioEstado(anterior: string | null, nuevo: string | null): string {
  if (anterior === "en_revision" && nuevo === "en_progreso") return "Devolvió la tarea a progreso";
  if (anterior === "completada") return "Reabrió la tarea";
  if (anterior === "descartada" && nuevo === "pendiente") return "Restauró la tarea";
  if (nuevo === "descartada") return "Descartó la tarea";
  if (nuevo === "en_progreso") return "Empezó la tarea";
  if (nuevo === "en_revision") return "Envió la tarea a revisión";
  if (nuevo === "completada") return "Aprobó y completó la tarea";
  const etiqueta = (valor: string | null) => valor ? ETIQUETA_ESTADO_TAREA[valor] ?? valor : "Sin estado";
  return `Cambió el estado de ${etiqueta(anterior)} a ${etiqueta(nuevo)}`;
}

export function describirCambioTarea(
  entrada: Pick<EntradaHistorialTarea, "accion" | "valorAnterior" | "valorNuevo">,
  nombres: ReadonlyMap<number, string>,
): string {
  if (entrada.accion === "creada") return "Creó la tarea";
  if (entrada.accion === "vista") return "Vio la tarea por primera vez";
  if (entrada.accion === "fecha_limite") {
    return `Cambió la fecha límite de ${fechaHistorial(entrada.valorAnterior)} a ${fechaHistorial(entrada.valorNuevo)}`;
  }
  if (entrada.accion === "peso") {
    return `Cambió el peso de ${entrada.valorAnterior ?? "?"} a ${entrada.valorNuevo ?? "?"}`;
  }
  if (entrada.accion === "estado") {
    const anterior = leerValorEstadoHistorial(entrada.valorAnterior);
    const nuevo = leerValorEstadoHistorial(entrada.valorNuevo);
    const cambio = describirCambioEstado(anterior.estado, nuevo.estado);
    return nuevo.motivo ? `${cambio}. Motivo: ${nuevo.motivo}` : cambio;
  }
  const responsable = (valor: string | null) => valor === null
    ? "Sin asignar"
    : nombres.get(Number(valor)) ?? "Integrante no disponible";
  if (entrada.valorNuevo === null) {
    return `Dejó la tarea sin asignar (responsable anterior: ${responsable(entrada.valorAnterior)})`;
  }
  return `Reasignó de ${responsable(entrada.valorAnterior)} a ${responsable(entrada.valorNuevo)}`;
}
