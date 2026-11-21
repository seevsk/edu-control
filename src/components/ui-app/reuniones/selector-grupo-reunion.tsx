"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Video, X } from "lucide-react";
import { useEsMovil } from "@/hooks/use-es-movil";
import { aOracion } from "@/lib/presentacion";
import { cn } from "@/lib/utils";
import { reunirseAhoraAction } from "@/app/(app)/reuniones/actions";
import { ACCION_MOVIL } from "@/components/ui-app/page-header";
import { CourseDot } from "@/components/ui-app/course-dot";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { BotonReunirseAhora } from "./boton-reunirse-ahora";
import { claseBotonReunion, type TamanoBoton } from "./boton-unirse";
import { PuntoEnCurso } from "./punto-en-curso";

export interface GrupoParaReunirse {
  idGrupo: number;
  nombre: string;
  curso: { idCurso: number; nombre: string } | null;
  enCurso: boolean;
}

function BotonIcono() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-label="Reunirse ahora" aria-disabled={pending} onClick={(e) => pending && e.preventDefault()} className={ACCION_MOVIL}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Video aria-hidden />}
    </button>
  );
}

function Envio({ movil }: { movil: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-disabled={pending}
      aria-busy={pending}
      onClick={(e) => pending && e.preventDefault()}
      className={cn(claseBotonReunion(movil ? "barra" : "m", pending ? "cargando" : "activo"), !movil && "h-[34px]")}
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Video aria-hidden />}
      {pending ? "Creando sala…" : "Reunirse"}
    </button>
  );
}

/** Opciones de grupo (radio nativo, con la estética del tablero). */
function Opciones({ grupos, elegido, alElegir }: { grupos: GrupoParaReunirse[]; elegido: number; alElegir: (id: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Grupo" className="flex flex-col gap-2">
      {grupos.map((grupo) => {
        const activo = grupo.idGrupo === elegido;
        return (
          <label
            key={grupo.idGrupo}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] border px-3 focus-within:ring-3 focus-within:ring-ring/50 md:min-h-11",
              activo ? "border-border-strong bg-accent" : "border-border-subtle hover:bg-muted",
            )}
          >
            <input type="radio" name="grupo" value={grupo.idGrupo} checked={activo} onChange={() => alElegir(grupo.idGrupo)} className="sr-only" />
            <span
              aria-hidden
              className={cn("size-4 shrink-0 rounded-full border-[1.5px]", activo ? "border-[5px] border-primary" : "border-subtle-foreground")}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm">
                {grupo.curso ? <CourseDot idCurso={grupo.curso.idCurso} /> : null}
                <span className="truncate">{aOracion(grupo.nombre)}</span>
              </span>
              {grupo.curso || grupo.enCurso ? (
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-subtle-foreground">
                  {grupo.curso ? <span className="truncate">{aOracion(grupo.curso.nombre)}</span> : null}
                  {grupo.curso && grupo.enCurso ? <span aria-hidden>·</span> : null}
                  {grupo.enCurso ? (
                    <span className="inline-flex items-center gap-1.5 text-cat-reunion-fg">
                      <PuntoEnCurso tamano={6} />
                      En curso
                    </span>
                  ) : null}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * "Reunirse ahora" del módulo. Con un solo grupo posible actúa directo; con varios abre el selector
 * (diálogo en escritorio y tablet, hoja inferior en móvil).
 */
export function SelectorGrupoReunion({
  grupos,
  tamano = "m",
  icono = false,
  className,
}: {
  grupos: GrupoParaReunirse[];
  tamano?: TamanoBoton;
  /** Solo el ícono de 44 px del encabezado móvil. */
  icono?: boolean;
  className?: string;
}) {
  const movil = useEsMovil();
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState(grupos[0]?.idGrupo ?? 0);

  if (grupos.length === 0) return null;
  if (grupos.length === 1 && icono) {
    return (
      <form action={reunirseAhoraAction.bind(null, grupos[0].idGrupo)} className={className}>
        <BotonIcono />
      </form>
    );
  }
  if (grupos.length === 1) {
    return <BotonReunirseAhora idGrupo={grupos[0].idGrupo} enCurso={grupos[0].enCurso} tamano={tamano} className={className} />;
  }

  const accion = reunirseAhoraAction.bind(null, elegido);
  const disparador = icono ? (
    <button type="button" onClick={() => setAbierto(true)} aria-label="Reunirse ahora" className={cn(ACCION_MOVIL, className)}>
      <Video aria-hidden />
    </button>
  ) : (
    <button type="button" onClick={() => setAbierto(true)} className={cn(claseBotonReunion(tamano, "activo"), className)}>
      <Video aria-hidden />
      Reunirse ahora
    </button>
  );

  if (movil) {
    return (
      <>
        {disparador}
        <Sheet open={abierto} onOpenChange={setAbierto}>
          <SheetContent side="bottom" showCloseButton={false} className="gap-0 rounded-t-[18px] p-0">
            <span aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-border" />
            <div className="flex h-12 items-center pr-1.5 pl-4">
              <SheetTitle className="flex-1 text-[17px] font-bold">Reunirse ahora</SheetTitle>
              <SheetClose asChild>
                <Button type="button" variant="ghost" aria-label="Cerrar" className="size-11 rounded-full">
                  <X aria-hidden />
                </Button>
              </SheetClose>
            </div>
            <SheetDescription className="sr-only">Elige el grupo de la reunión</SheetDescription>
            <form action={accion}>
              <div className="px-4 pt-1 pb-4">
                <Opciones grupos={grupos} elegido={elegido} alElegir={setElegido} />
              </div>
              <div className="border-t px-4 pt-3 pb-[calc(1.875rem+env(safe-area-inset-bottom))]">
                <Envio movil />
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      {disparador}
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent showCloseButton={false} className="top-40 max-w-[420px] translate-y-0 gap-0 overflow-hidden rounded-[14px] p-0 sm:max-w-[420px]">
          <div className="flex items-center gap-3 pt-4 pr-4 pb-2 pl-5">
            <DialogTitle className="flex-1 text-base font-semibold">Reunirse ahora</DialogTitle>
            <Button type="button" variant="ghost" aria-label="Cerrar" title="Cerrar" onClick={() => setAbierto(false)} className="size-8 text-muted-foreground">
              <X aria-hidden />
            </Button>
          </div>
          <DialogDescription className="sr-only">Elige el grupo de la reunión</DialogDescription>
          <form action={accion}>
            <div className="px-5 pt-1 pb-4">
              <Opciones grupos={grupos} elegido={elegido} alElegir={setElegido} />
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <Button type="button" variant="outline" onClick={() => setAbierto(false)} className="h-[34px]">
                Cancelar
              </Button>
              <Envio movil={false} />
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
