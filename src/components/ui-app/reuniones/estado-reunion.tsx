import { Clock, DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { PuntoEnCurso } from "./punto-en-curso";

export type VarianteEstado = "en_curso" | "sala_abierta" | "empieza" | "por_cerrar" | "terminada";

/** Estado de una reunión como etiqueta: píldora "En curso", "Sala abierta", "Empieza en…", "Cierra en…" o "Terminada". */
export function EstadoReunion({
  estado,
  tamano = "md",
  minutos,
  texto,
  className,
}: {
  estado: VarianteEstado;
  tamano?: "md" | "lg";
  minutos?: number;
  /** Etiqueta relativa ("Mañana", "Lun 23") en lugar de "Empieza en N min". */
  texto?: string;
  className?: string;
}) {
  switch (estado) {
    case "en_curso":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-cat-reunion-bg pr-[9px] pl-2 font-semibold whitespace-nowrap text-cat-reunion-fg",
            tamano === "lg" ? "h-[26px] text-[13px]" : "h-[22px] text-xs",
            className,
          )}
        >
          <PuntoEnCurso tamano={7} />
          En curso
        </span>
      );
    case "sala_abierta":
      return (
        <span className={cn("inline-flex items-center gap-[5px] font-semibold whitespace-nowrap text-cat-reunion-fg", tamano === "lg" ? "text-[13px]" : "text-xs", className)}>
          <DoorOpen className="size-[13px]" aria-hidden />
          Sala abierta
        </span>
      );
    case "empieza":
      return (
        <span className={cn("inline-flex items-center gap-[5px] text-xs whitespace-nowrap text-muted-foreground", className)}>
          <Clock className="size-[13px]" aria-hidden />
          {texto ?? `Empieza en ${minutos ?? 0} min`}
        </span>
      );
    case "por_cerrar":
      return (
        <span className={cn("inline-flex h-[22px] items-center gap-[5px] rounded-full bg-hoy/12 px-[9px] text-xs font-semibold whitespace-nowrap text-hoy", className)}>
          <Clock className="size-[13px]" strokeWidth={2.2} aria-hidden />
          Cierra en {minutos ?? 0} min
        </span>
      );
    case "terminada":
      return <span className={cn("text-xs whitespace-nowrap text-subtle-foreground", className)}>Terminada</span>;
  }
}
