import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ACCION_MOVIL } from "@/components/ui-app/page-header";
import { BotonReunirseAhora } from "./boton-reunirse-ahora";

/**
 * Acción doble del encabezado del grupo. Escritorio: "Reunirse ahora" (o "Unirse a la reunión en
 * curso") y "Programar reunión". Tablet: el primario de 44 px y "Programar" solo con ícono.
 * Móvil: no se dibuja aquí (ver `ProgramarMovil` y el botón flotante).
 */
export function AccionDobleGrupo({ idGrupo, enCurso }: { idGrupo: number; enCurso: boolean }) {
  const programar = `/reuniones/nueva?grupo=${idGrupo}`;
  return (
    <>
      <BotonReunirseAhora idGrupo={idGrupo} enCurso={enCurso} tamano="tactil" className="hidden md:block lg:hidden" />
      <BotonReunirseAhora idGrupo={idGrupo} enCurso={enCurso} tamano="m" className="hidden lg:block" />
      <Button variant="outline" asChild className="hidden h-8 px-3 text-[13px] lg:inline-flex">
        <Link href={programar}>
          <CalendarPlus aria-hidden />
          Programar reunión
        </Link>
      </Button>
      <Link
        href={programar}
        aria-label="Programar reunión"
        title="Programar reunión"
        className="hidden size-11 items-center justify-center rounded-xl border border-input hover:bg-muted md:flex lg:hidden"
      >
        <CalendarPlus className="size-[18px]" aria-hidden />
      </Link>
    </>
  );
}

/** Ícono de 44 px "Programar reunión" para el encabezado móvil del grupo. */
export function ProgramarMovil({ idGrupo, className }: { idGrupo: number; className?: string }) {
  return (
    <Link href={`/reuniones/nueva?grupo=${idGrupo}`} aria-label="Programar reunión" className={cn(ACCION_MOVIL, className)}>
      <CalendarPlus aria-hidden />
    </Link>
  );
}

/** Botón flotante móvil de la pestaña Reuniones: "Reunirse ahora" o "Unirse a la reunión en curso". */
export function FabReunirse({ idGrupo, enCurso }: { idGrupo: number; enCurso: boolean }) {
  return (
    <BotonReunirseAhora
      idGrupo={idGrupo}
      enCurso={enCurso}
      tamano="fab"
      className="fixed right-4 bottom-[calc(6.125rem+env(safe-area-inset-bottom))] z-30 md:hidden"
    />
  );
}
