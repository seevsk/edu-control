"use client";

import { useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Separa "¿Eliminar X? Detalle..." en título y detalle; sin signo de cierre, todo es título. */
function partirMensaje(mensaje: string) {
  const fin = mensaje.indexOf("?");
  if (fin === -1) return { titulo: mensaje.trim(), detalle: "" };
  return { titulo: mensaje.slice(0, fin + 1).trim(), detalle: mensaje.slice(fin + 1).trim() };
}

/** Botón de un formulario que pide confirmación en un diálogo de la app antes de enviarlo. */
export function BotonConfirmacion({
  children,
  mensaje,
  className = "",
  destructivo,
}: {
  children: React.ReactNode;
  mensaje: string;
  className?: string;
  /** Por defecto se deduce de la clase (texto rojo). */
  destructivo?: boolean;
}) {
  const boton = useRef<HTMLButtonElement>(null);
  const { titulo, detalle } = partirMensaje(mensaje);
  const esDestructivo = destructivo ?? className.includes("destructive");

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button ref={boton} type="button" className={className}>
          {children}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {detalle ? <AlertDialogDescription className="whitespace-pre-line">{detalle}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="max-md:h-11">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={esDestructivo ? "destructive" : "default"}
            className="max-md:h-11"
            onClick={() => boton.current?.form?.requestSubmit()}
          >
            {children}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
