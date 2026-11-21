import { UserAvatar } from "@/components/ui-app/user-avatar";
import { cn } from "@/lib/utils";

const TAMANOS = { 20: "xs", 22: "sm", 24: "md", 26: "sm" } as const;

interface Persona {
  idUsuario: number;
  nombre: string;
  apellidos: string | null;
  fotoUrl: string | null;
}

/** Avatares solapados (−6 px) con un anillo del color del fondo. */
export function AvataresApilados({
  personas,
  tamano = 22,
  max = 4,
  anillo = "ring-background",
  className,
}: {
  personas: Persona[];
  tamano?: keyof typeof TAMANOS;
  max?: number;
  /** Clase `ring-*` con el color del fondo sobre el que se dibuja. */
  anillo?: string;
  className?: string;
}) {
  if (personas.length === 0) return null;
  const visibles = personas.slice(0, max);
  const resto = personas.length - visibles.length;
  return (
    <span className={cn("flex items-center -space-x-1.5", className)}>
      {visibles.map((p) => (
        <UserAvatar key={p.idUsuario} usuario={p} tamano={TAMANOS[tamano]} className={cn("ring-2", anillo, tamano === 26 && "size-[26px] text-[11px]")} />
      ))}
      {resto > 0 ? (
        <span className={cn("grid shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground ring-2", anillo)} style={{ width: tamano, height: tamano }}>
          +{resto}
        </span>
      ) : null}
    </span>
  );
}
