import { cn } from "@/lib/utils";
import { diaYMes, fechaCorta, fechaCompleta } from "@/lib/formato-fecha";
import { diasHasta } from "@/lib/calendario";

/** Fecha limite en lenguaje natural (America/Lima): "Hoy, 11:59 pm", "Vencida hace 3 días", "Mar 17". */
export function textoVencimiento(fecha: Date, ahora: Date, cerrada: boolean): { texto: string; tono: "normal" | "hoy" | "vencida" | "apagado" } {
  if (cerrada) return { texto: diaYMes(fecha, ahora), tono: "apagado" };
  const dias = diasHasta(fecha, ahora);
  if (fecha < ahora) {
    if (dias === 0) return { texto: "Vencida hoy", tono: "vencida" };
    if (dias === -1) return { texto: "Vencida ayer", tono: "vencida" };
    return { texto: `Vencida hace ${-dias} días`, tono: "vencida" };
  }
  if (dias === 0) return { texto: fechaCorta(fecha, { ahora, conHora: true }), tono: "hoy" };
  return { texto: fechaCorta(fecha, { ahora }), tono: "normal" };
}

const TONOS = {
  normal: "border-border text-muted-foreground",
  hoy: "border-hoy/30 text-hoy",
  vencida: "border-vencida/30 text-vencida",
  apagado: "border-transparent text-subtle-foreground",
} as const;

export function DueChip({ fecha, cerrada = false, ahora, className }: { fecha: Date | null; cerrada?: boolean; ahora: Date; className?: string }) {
  if (!fecha) return null;
  const { texto, tono } = textoVencimiento(fecha, ahora, cerrada);
  return (
    <time dateTime={fecha.toISOString()} title={fechaCompleta(fecha)} className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs tabular-nums whitespace-nowrap", TONOS[tono], className)}>
      {texto}
    </time>
  );
}
