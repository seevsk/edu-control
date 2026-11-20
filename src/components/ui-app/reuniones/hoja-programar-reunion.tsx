"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useEsMovil } from "@/hooks/use-es-movil";

/**
 * Hoja inferior "Programar reunión" (solo móvil, Claude Design P4), controlada por `?programar=1`
 * en la pestaña Reuniones del grupo: "atrás" o la X la cierran. En tablet y escritorio no se dibuja
 * (ahí se usa /reuniones/nueva). El botón de enviar vive dentro del formulario, fijo abajo.
 */
export function HojaProgramarReunion({ cerrarEn, children }: { cerrarEn: string; children: ReactNode }) {
  const router = useRouter();
  const movil = useEsMovil();
  if (!movil) return null;
  return (
    <Sheet open onOpenChange={(abierto) => { if (!abierto) router.replace(cerrarEn, { scroll: false }); }}>
      <SheetContent side="bottom" showCloseButton={false} className="h-[92dvh] max-h-[92dvh] gap-0 rounded-t-[18px] p-0">
        <span className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-input" aria-hidden />
        <div className="flex h-12 shrink-0 items-center pr-1.5 pl-4">
          <SheetTitle className="flex-1 text-[17px] font-bold">Programar reunión</SheetTitle>
          <SheetDescription className="sr-only">Elige fecha y hora para el grupo.</SheetDescription>
          <SheetClose
            aria-label="Cerrar"
            className="inline-flex size-11 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-[21px]" aria-hidden />
          </SheetClose>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
