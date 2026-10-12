import { colorCurso, inicialesCurso } from "@/lib/color-curso";

const TAMANOS = { sm: "size-8 text-xs", md: "size-10 text-sm" } as const;

/** Cuadrado de color con las iniciales del curso (color derivado de un hash, sin columna en la BD). */
export function IconoCurso({
  nombre,
  codigo,
  tamano = "md",
}: {
  nombre: string;
  codigo?: string | null;
  tamano?: keyof typeof TAMANOS;
}) {
  const color = colorCurso(codigo || nombre);
  return (
    <span
      className={`flex ${TAMANOS[tamano]} shrink-0 items-center justify-center rounded-md font-semibold`}
      style={{ backgroundColor: color.bg, color: color.fg }}
      aria-hidden
    >
      {inicialesCurso(nombre)}
    </span>
  );
}
