import { cn } from "@/lib/utils";

const TAMANOS = { 6: "size-1.5", 7: "size-[7px]", 8: "size-2", 10: "size-2.5" } as const;

/** Punto pulsante de "En curso". Nunca va solo: siempre acompaña un texto. El pulso se detiene con `prefers-reduced-motion`. */
export function PuntoEnCurso({ tamano = 8, className }: { tamano?: keyof typeof TAMANOS; className?: string }) {
  return <span aria-hidden className={cn("inline-block shrink-0 rounded-full bg-cat-reunion animate-pulso-reunion", TAMANOS[tamano], className)} />;
}
