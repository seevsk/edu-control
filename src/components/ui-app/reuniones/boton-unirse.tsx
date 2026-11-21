"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { unirseReunionAction } from "@/app/(app)/reuniones/actions";

export type TamanoBoton = "s" | "m" | "l" | "tactil" | "barra" | "fab";

const TAMANOS: Record<TamanoBoton, string> = {
  s: "h-[30px] rounded-lg px-3.5 text-[13px] [&_svg]:size-[15px]",
  m: "h-8 rounded-lg px-3.5 text-[13px] [&_svg]:size-[15px]",
  l: "h-10 rounded-lg px-3.5 text-sm [&_svg]:size-[15px]",
  tactil: "h-11 rounded-xl px-[18px] text-[15px] [&_svg]:size-[17px]",
  barra: "h-[50px] w-full rounded-xl px-[18px] text-[15px] [&_svg]:size-[17px]",
  fab: "h-14 rounded-full pr-5 pl-[18px] text-[15px] shadow-pop [&_svg]:size-[17px]",
};

/** Clases del botón primario de reunión; las comparte `BotonReunirseAhora`. */
export function claseBotonReunion(tamano: TamanoBoton, estado: "activo" | "deshabilitado" | "cargando") {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-[7px] border font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    TAMANOS[tamano],
    estado === "deshabilitado"
      ? "cursor-not-allowed border-border bg-accent text-subtle-foreground"
      : "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
    estado === "cargando" && "cursor-wait opacity-75",
  );
}

function Envio({ tamano, texto }: { tamano: TamanoBoton; texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-disabled={pending} aria-busy={pending} onClick={(e) => pending && e.preventDefault()} className={claseBotonReunion(tamano, pending ? "cargando" : "activo")}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Video aria-hidden />}
      {texto}
    </button>
  );
}

/**
 * "Unirse": registra la entrada y lleva a la sala. Con la sala sin abrir se muestra deshabilitado
 * (`aria-disabled`, sigue siendo enfocable). A los observadores no se les dibuja.
 */
export function BotonUnirse({
  idReunion,
  tamano = "m",
  deshabilitado = false,
  texto = "Unirse",
  anchoCompleto = false,
  className,
}: {
  idReunion: number;
  tamano?: TamanoBoton;
  deshabilitado?: boolean;
  texto?: string;
  anchoCompleto?: boolean;
  className?: string;
}) {
  const contenedor = cn(anchoCompleto && "w-full [&_button]:w-full", className);

  if (deshabilitado) {
    return (
      <span className={contenedor}>
        <button type="button" aria-disabled="true" className={claseBotonReunion(tamano, "deshabilitado")}>
          <Video aria-hidden />
          {texto}
        </button>
      </span>
    );
  }
  return (
    <form action={unirseReunionAction.bind(null, idReunion)} className={contenedor}>
      <Envio tamano={tamano} texto={texto} />
    </form>
  );
}
