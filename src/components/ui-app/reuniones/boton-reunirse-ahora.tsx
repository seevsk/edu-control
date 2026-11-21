"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { reunirseAhoraAction } from "@/app/(app)/reuniones/actions";
import { claseBotonReunion, type TamanoBoton } from "./boton-unirse";

function Envio({ tamano, texto }: { tamano: TamanoBoton; texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-disabled={pending} aria-busy={pending} onClick={(e) => pending && e.preventDefault()} className={claseBotonReunion(tamano, pending ? "cargando" : "activo")}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Video aria-hidden />}
      {pending ? "Creando sala…" : texto}
    </button>
  );
}

/**
 * "Reunirse ahora" crea la sala y lleva a ella. Con una sala ya abierta en el grupo (`enCurso`) dice
 * "Unirse a la reunión en curso": la acción entra a esa reunión en lugar de crear otra.
 */
export function BotonReunirseAhora({
  idGrupo,
  enCurso = false,
  tamano = "m",
  texto,
  anchoCompleto = false,
  className,
}: {
  idGrupo: number;
  enCurso?: boolean;
  tamano?: TamanoBoton;
  texto?: string;
  anchoCompleto?: boolean;
  className?: string;
}) {
  return (
    <form action={reunirseAhoraAction.bind(null, idGrupo)} className={cn(anchoCompleto && "w-full [&_button]:w-full", className)}>
      <Envio tamano={tamano} texto={texto ?? (enCurso ? "Unirse a la reunión en curso" : "Reunirse ahora")} />
    </form>
  );
}
