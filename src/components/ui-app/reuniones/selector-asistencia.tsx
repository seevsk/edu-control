"use client";

import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { responderReunionAction } from "@/app/(app)/reuniones/actions";
import type { Respuesta } from "./formato";

function Opcion({ valor, texto, activa, grande }: { valor: "asistire" | "no_asistire"; texto: string; activa: boolean; grande: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="respuesta"
      value={valor}
      aria-pressed={activa}
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-md px-[9px] text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70",
        grande ? "h-11 flex-1 text-sm md:h-[30px] md:flex-none md:text-xs" : "h-[26px]",
        activa ? "bg-accent text-foreground ring-1 ring-input" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {activa && valor === "asistire" ? <Check className="size-3" aria-hidden /> : null}
      {texto}
    </button>
  );
}

/** Segmentado "Asistiré / No asistiré". Cada opción es un formulario de la acción existente. */
export function SelectorAsistencia({ idReunion, valor, grande = false, className }: { idReunion: number; valor: Respuesta; grande?: boolean; className?: string }) {
  const accion = responderReunionAction.bind(null, idReunion);
  return (
    <div role="group" aria-label="Tu asistencia" className={cn("inline-flex gap-0.5 rounded-lg border bg-muted p-0.5", grande && "max-md:flex max-md:w-full", className)}>
      <form action={accion} className={cn(grande && "max-md:flex-1")}>
        <Opcion valor="asistire" texto="Asistiré" activa={valor === "asistire"} grande={grande} />
      </form>
      <form action={accion} className={cn(grande && "max-md:flex-1")}>
        <Opcion valor="no_asistire" texto="No asistiré" activa={valor === "no_asistire"} grande={grande} />
      </form>
    </div>
  );
}
