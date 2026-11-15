"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Panel lateral controlado por la URL: abierto mientras exista el parametro, al cerrar vuelve a `cerrarEn`. */
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
  return (
    <Sheet open onOpenChange={(abierto) => { if (!abierto) router.replace(cerrarEn, { scroll: false }); }}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="pr-8 text-base">{titulo}</SheetTitle>
          {descripcion ? <SheetDescription>{descripcion}</SheetDescription> : <SheetDescription className="sr-only">{titulo}</SheetDescription>}
        </SheetHeader>
        <div className="px-5 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
