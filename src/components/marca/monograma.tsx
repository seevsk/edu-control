import { cn } from "@/lib/utils";

/**
 * Monograma "e" de EduControl (Claude Design, "Ícono v2 · sistema"). Toma los colores del tema:
 * fondo tinta y letra clara en el tema claro; se invierte en el oscuro.
 */
export function Monograma({ className, titulo = "EduControl" }: { className?: string; titulo?: string | null }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-[22px] shrink-0", className)} role={titulo ? "img" : undefined} aria-label={titulo ?? undefined} aria-hidden={titulo ? undefined : true}>
      <rect width="32" height="32" rx="7.5" className="fill-foreground" />
      <path d="M24.6 16a8.6 8.6 0 1 0-2.1 5.65" fill="none" className="stroke-background" strokeWidth="4.8" strokeLinecap="butt" />
      <rect x="9.4" y="13.9" width="15.2" height="4.2" rx="0.6" className="fill-background" />
    </svg>
  );
}

/** Monograma + nombre, para cabeceras. */
export function Logotipo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Monograma titulo={null} className="size-[26px]" />
      <span className="text-base font-semibold tracking-[-0.02em]">EduControl</span>
    </span>
  );
}
