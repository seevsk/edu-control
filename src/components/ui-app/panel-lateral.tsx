"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useEsMovil } from "@/hooks/use-es-movil";
import { cn } from "@/lib/utils";

/**
 * Panel controlado por la URL: abierto mientras exista el parametro, al cerrar vuelve a `cerrarEn`.
 * Móvil: hoja inferior (Claude Design, "Móvil · hoja"). Tablet: hoja lateral de 420 px. Escritorio: más ancha.
 */
export function PanelLateral({
  titulo,
  descripcion,
  cerrarEn,
  children,
}: {
  titulo: string;
  descripcion?: string;
  cerrarEn: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const movil = useEsMovil();
  return (
    <Sheet open onOpenChange={(abierto) => { if (!abierto) router.replace(cerrarEn, { scroll: false }); }}>
      <SheetContent
        side={movil ? "bottom" : "right"}
        className={cn(
          "w-full gap-0 overflow-y-auto p-0",
          movil ? "max-h-[92dvh] rounded-t-[18px] pb-[env(safe-area-inset-bottom)]" : "data-[side=right]:sm:max-w-[420px] data-[side=right]:lg:max-w-xl",
        )}
      >
        {movil ? <span className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-input" aria-hidden /> : null}
        <SheetHeader className={cn("border-b px-5 py-4", movil && "pt-2")}>
          <SheetTitle className="pr-8 text-base max-md:pr-12">{titulo}</SheetTitle>
          {descripcion ? <SheetDescription>{descripcion}</SheetDescription> : <SheetDescription className="sr-only">{titulo}</SheetDescription>}
        </SheetHeader>
        <div className="px-5 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
