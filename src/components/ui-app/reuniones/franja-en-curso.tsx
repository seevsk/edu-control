import { hora } from "@/lib/formato-fecha";
import { BotonUnirse } from "./boton-unirse";
import { PuntoEnCurso } from "./punto-en-curso";

/**
 * Franja "En curso" de las pestañas del grupo (menos Reuniones). Sin botón para observadores.
 * Móvil: pegada arriba al desplazar; tablet y escritorio: bajo las pestañas, sin fijar.
 */
export function FranjaEnCurso({
  reunion,
  puedeUnirse,
}: {
  reunion: { idReunion: number; titulo: string; inicio: Date };
  puedeUnirse: boolean;
}) {
  return (
    <div
      role="status"
      className="flex min-h-14 items-center gap-2.5 border-b border-cat-reunion/20 bg-cat-reunion-bg px-4 text-sm max-md:sticky max-md:top-0 max-md:z-10 md:px-5 lg:min-h-11 lg:px-6 lg:text-[13px]"
    >
      <PuntoEnCurso tamano={8} />
      <span className="shrink-0 font-semibold text-cat-reunion-fg">En curso</span>
      <span aria-hidden className="text-subtle-foreground">·</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{reunion.titulo}</span>
        <span className="text-muted-foreground"> · desde {hora(reunion.inicio)}</span>
      </span>
      {puedeUnirse ? (
        <>
          <BotonUnirse idReunion={reunion.idReunion} tamano="s" className="hidden lg:block" />
          <BotonUnirse idReunion={reunion.idReunion} tamano="tactil" className="lg:hidden" />
        </>
      ) : null}
    </div>
  );
}
