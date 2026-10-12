import { Avatar } from "@/components/avatar";

type Persona = { idUsuario: number; nombre: string; apellidos: string | null; fotoUrl: string | null };

/** Integrantes de un grupo como circulos superpuestos (relacion, no asignacion), con "+n" si son muchos. */
export function AvataresGrupo({ personas, maximo = 4 }: { personas: Persona[]; maximo?: number }) {
  const visibles = personas.slice(0, maximo);
  const resto = personas.length - visibles.length;
  const nombres = personas.map((p) => `${p.nombre} ${p.apellidos ?? ""}`.trim()).join(", ");

  return (
    <span className="flex -space-x-1.5" title={nombres} aria-label={`Integrantes: ${nombres}`}>
      {visibles.map((persona) => (
        <span key={persona.idUsuario} className="rounded-full ring-2 ring-surface">
          <Avatar nombre={persona.nombre} apellidos={persona.apellidos} fotoUrl={persona.fotoUrl} tamano="sm" />
        </span>
      ))}
      {resto > 0 ? (
        <span className="flex size-6 items-center justify-center rounded-full bg-bg text-[10px] font-medium text-text-muted ring-2 ring-surface">
          +{resto}
        </span>
      ) : null}
    </span>
  );
}
