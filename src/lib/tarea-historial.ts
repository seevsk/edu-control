import { ETIQUETA_ESTADO_TAREA } from "@/lib/estado-tarea";

const SEPARADOR_MOTIVO_DEVOLUCION = "\n\nMotivo de devolución: ";

export function valorHistorialDevolucion(motivo: string): string {
  return `en_progreso${SEPARADOR_MOTIVO_DEVOLUCION}${motivo}`;
}

export function leerValorEstadoHistorial(valor: string | null): { estado: string | null; motivo: string | null } {
  if (!valor) return { estado: valor, motivo: null };
  const indice = valor.indexOf(SEPARADOR_MOTIVO_DEVOLUCION);
  if (indice === -1) return { estado: valor, motivo: null };
  return {
    estado: valor.slice(0, indice),
    motivo: valor.slice(indice + SEPARADOR_MOTIVO_DEVOLUCION.length),
  };
}

export interface EntradaHistorialTarea {
  idHistorial: number;
  accion: "creada" | "estado" | "reasignada";
  valorAnterior: string | null;
  valorNuevo: string | null;
  fecha: Date;
  usuario: { nombre: string; apellidos: string | null };
  tarea?: { idTarea: number; titulo: string };
}

export function describirCambioTarea(
  entrada: Pick<EntradaHistorialTarea, "accion" | "valorAnterior" | "valorNuevo">,
  nombres: ReadonlyMap<number, string>,
): string {
  if (entrada.accion === "creada") return "Creó la tarea";
  if (entrada.accion === "estado") {
    const anterior = leerValorEstadoHistorial(entrada.valorAnterior);
    const nuevo = leerValorEstadoHistorial(entrada.valorNuevo);
    const etiqueta = (valor: string | null) => valor ? ETIQUETA_ESTADO_TAREA[valor] ?? valor : "Sin estado";
    const cambio = `Cambió el estado de ${etiqueta(anterior.estado)} a ${etiqueta(nuevo.estado)}`;
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
