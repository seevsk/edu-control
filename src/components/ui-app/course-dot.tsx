import { cn } from "@/lib/utils";
import { colorCurso } from "@/lib/presentacion";

/** Identidad del curso: un punto de color, nunca un borde ni un fondo. */
export function CourseDot({ idCurso, className }: { idCurso: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-[2px]", className)}
      style={{ backgroundColor: colorCurso(idCurso) }}
    />
  );
}
