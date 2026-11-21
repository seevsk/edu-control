import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { aOracion } from "@/lib/presentacion";
import { cn } from "@/lib/utils";
import { CourseDot } from "@/components/ui-app/course-dot";
import { buttonVariants } from "@/components/ui/button";

/** Clases de los botones de las pantallas de estado: 34 px en escritorio, 50 px y ancho fijo en móvil. */
export const BOTON_ESTADO = "h-[34px] w-[260px] max-md:h-[50px] max-md:rounded-xl max-md:text-[15px]";

/** Botón secundario o primario de las pantallas de estado de la sala, como enlace. */
export function EnlaceEstado({ href, variante = "outline", children }: { href: string; variante?: "default" | "outline"; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: variante }), BOTON_ESTADO)}>
      {children}
    </Link>
  );
}

/**
 * Pantalla de estado de la sala (aún no abre, terminó, error): encabezado reducido con "Volver",
 * título y grupo, y un cuerpo centrado con ícono, texto y botones.
 */
export function MarcoEstadoSala({
  idReunion,
  titulo,
  grupo,
  icono,
  texto,
  children,
}: {
  idReunion: number;
  titulo: string;
  grupo: { nombre: string; idCurso: number | null };
  icono: React.ReactNode;
  texto: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b bg-background pr-3 pl-2 max-md:h-auto max-md:min-h-12 max-md:pt-[env(safe-area-inset-top)]">
        <Link href={`/reuniones/${idReunion}`} aria-label="Volver" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-secondary max-md:size-11">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="min-w-0 truncate text-sm font-semibold max-md:text-[15px]">{titulo}</h1>
        <span className="inline-flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground max-md:hidden">
          {grupo.idCurso !== null ? <CourseDot idCurso={grupo.idCurso} className="size-[7px]" /> : null}
          <span className="truncate">{aOracion(grupo.nombre)}</span>
        </span>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-3.5 p-6 text-center">
        <span className="grid size-12 place-items-center rounded-[14px] bg-accent text-muted-foreground [&_svg]:size-6">{icono}</span>
        <p className="text-[17px] font-semibold text-balance">{texto}</p>
        <div className="flex flex-col items-center gap-2">{children}</div>
      </main>
    </>
  );
}
