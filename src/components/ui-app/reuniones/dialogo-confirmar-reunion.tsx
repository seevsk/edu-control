"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import { useEsMovil } from "@/hooks/use-es-movil";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

function Envio({ texto, movil }: { texto: string; movil: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      aria-disabled={pending}
      onClick={(e) => pending && e.preventDefault()}
      className={cn("border-transparent bg-destructive font-semibold text-white hover:bg-destructive/90 dark:text-background", movil ? "h-[50px] w-full rounded-xl text-[15px]" : "h-[34px]")}
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {texto}
    </Button>
  );
}

/**
 * Confirmación destructiva de una reunión ("Finalizar para todos", "Cancelar reunión"). Escritorio:
 * diálogo alineado arriba. Móvil: hoja inferior con los botones apilados (Finalizar y debajo Cancelar).
 */
export function DialogoConfirmarReunion({
  abierto,
  alCambiar,
  titulo,
  confirmar,
  accion,
}: {
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  titulo: string;
  confirmar: string;
  accion: () => Promise<void>;
}) {
  const movil = useEsMovil();

  if (movil) {
    return (
      <Sheet open={abierto} onOpenChange={alCambiar}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 rounded-t-[18px] p-0 pb-[calc(1.875rem+env(safe-area-inset-bottom))]">
          <span aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-border" />
          <SheetTitle className="px-4 pt-4 pb-5 text-lg font-bold">{titulo}</SheetTitle>
          <SheetDescription className="sr-only">{titulo}</SheetDescription>
          <form action={accion} className="flex flex-col gap-2 px-4">
            <Envio texto={confirmar} movil />
            <SheetClose asChild>
              <Button type="button" variant="outline" className="h-[50px] w-full rounded-xl text-[15px]">
                Cancelar
              </Button>
            </SheetClose>
          </form>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <AlertDialog open={abierto} onOpenChange={alCambiar}>
      <AlertDialogContent className="top-1/3 max-w-[400px] translate-y-0 gap-0 rounded-[14px] p-0 data-[size=default]:sm:max-w-[400px]">
        <AlertDialogHeader className="flex flex-row items-center gap-3 py-4 pr-4 pl-5 pb-4">
          <AlertDialogTitle className="flex-1 text-base font-semibold">{titulo}</AlertDialogTitle>
          <AlertDialogCancel variant="ghost" aria-label="Cerrar" className="size-8 shrink-0 border-0 p-0 text-muted-foreground">
            <X aria-hidden />
          </AlertDialogCancel>
        </AlertDialogHeader>
        <AlertDialogDescription className="sr-only">{titulo}</AlertDialogDescription>
        <form action={accion} className="flex justify-end gap-2 border-t px-5 py-3">
          <AlertDialogCancel className="h-[34px]">Cancelar</AlertDialogCancel>
          <Envio texto={confirmar} movil={false} />
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
