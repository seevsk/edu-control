import { Undo2 } from "lucide-react";
import { StatusIcon } from "@/components/ui-app/status-icon";
import { ETIQUETA_RESULTADO_ENTREGA, type ResultadoEntrega } from "@/lib/entregas";
import { cn } from "@/lib/utils";

/** Resultado de una entrega: ícono de forma + texto + color (nunca solo color). */
export function EtiquetaResultado({ resultado, className }: { resultado: ResultadoEntrega; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        resultado === "devuelta" && "text-estado-en-progreso",
        className,
      )}
    >
      {resultado === "devuelta" ? (
        <Undo2 className="size-4 shrink-0" aria-hidden />
      ) : (
        <StatusIcon estado={resultado === "aprobada" ? "completada" : "en_revision"} conTexto={false} className="size-4" />
      )}
      {ETIQUETA_RESULTADO_ENTREGA[resultado]}
    </span>
  );
}
