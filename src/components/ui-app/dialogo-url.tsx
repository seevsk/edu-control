"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useEsMovil } from "@/hooks/use-es-movil";

/**
 * Formulario corto controlado por la URL (evaluación, sesión, tiempo ocupado): diálogo centrado
 * desde tablet; en móvil, hoja inferior (Claude Design, "Móvil · Tiempo ocupado (hoja)").
 */
export function DialogoUrl({
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
  const cerrar = (abierto: boolean) => { if (!abierto) router.replace(cerrarEn, { scroll: false }); };

  if (movil) {
    return (
      <Sheet open onOpenChange={cerrar}>
        <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-[18px] p-0 pb-[env(safe-area-inset-bottom)]">
          <span className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-input" aria-hidden />
          <SheetHeader className="px-5 pt-2 pb-3">
            <SheetTitle className="pr-8 text-lg">{titulo}</SheetTitle>
            {descripcion ? <SheetDescription>{descripcion}</SheetDescription> : <SheetDescription className="sr-only">{titulo}</SheetDescription>}
          </SheetHeader>
          <div className="flex flex-col gap-4 px-5 pb-5">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open onOpenChange={cerrar}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion ? <DialogDescription>{descripcion}</DialogDescription> : <DialogDescription className="sr-only">{titulo}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
