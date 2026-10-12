import { ETIQUETA_ESTADO_TAREA } from "@/lib/estado-tarea";

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
    const etiqueta = (valor: string | null) => valor ? ETIQUETA_ESTADO_TAREA[valor] ?? valor : "Sin estado";
    return `Cambió el estado de ${etiqueta(entrada.valorAnterior)} a ${etiqueta(entrada.valorNuevo)}`;
  }
  const responsable = (valor: string | null) => valor === null
    ? "Sin asignar"
    : nombres.get(Number(valor)) ?? "Integrante no disponible";
  if (entrada.valorNuevo === null) {
    return `Dejó la tarea sin asignar (responsable anterior: ${responsable(entrada.valorAnterior)})`;
  }
  return `Reasignó de ${responsable(entrada.valorAnterior)} a ${responsable(entrada.valorNuevo)}`;
}
