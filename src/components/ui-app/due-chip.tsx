import { cn } from "@/lib/utils";
import { horaLima } from "@/lib/dates";
import { diasHasta, diaMesCorto, fechaEnZonaLimaISO } from "@/lib/calendario";

/** Fecha limite en lenguaje natural, en America/Lima: "Vence hoy 11:59 PM", "Vencida hace 3 días", "22 nov". */
export function textoVencimiento(fecha: Date, ahora: Date, cerrada: boolean): { texto: string; tono: "normal" | "hoy" | "vencida" | "apagado" } {
  const corta = diaMesCorto(fechaEnZonaLimaISO(fecha));
  if (cerrada) return { texto: corta, tono: "apagado" };
  const dias = diasHasta(fecha, ahora);
  if (fecha < ahora) {
    if (dias === 0) return { texto: "Vencida hoy", tono: "vencida" };
    if (dias === -1) return { texto: "Vencida ayer", tono: "vencida" };
    return { texto: `Vencida hace ${-dias} días`, tono: "vencida" };
  }
  if (dias === 0) return { texto: `Vence hoy ${horaLima(fecha)}`, tono: "hoy" };
  if (dias === 1) return { texto: "Mañana", tono: "normal" };
  return { texto: corta, tono: "normal" };
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
    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs tabular-nums whitespace-nowrap", TONOS[tono], className)}>
      {texto}
    </span>
  );
}
