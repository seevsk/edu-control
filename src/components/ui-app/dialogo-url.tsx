"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Dialog centrado controlado por la URL: para crear o editar un elemento hijo (evaluación, sesión). */
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
  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) router.replace(cerrarEn, { scroll: false }); }}>
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
