"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cambiarVisibilidadAction, eliminarCuentaAction } from "../actions";

/** Se guarda al instante; si falla, vuelve al valor anterior y avisa. */
export function SwitchVisibilidad({ inicial }: { inicial: boolean }) {
  const [visible, setVisible] = useState(inicial);
  const [guardando, iniciar] = useTransition();
  return (
    <Switch
      id="visible-en-busqueda"
      checked={visible}
      disabled={guardando}
      aria-describedby="visible-en-busqueda-ayuda"
      onCheckedChange={(valor) => {
        setVisible(valor);
        iniciar(async () => {
          const resultado = await cambiarVisibilidadAction(valor);
          if (resultado.ok) toast.success("Guardado");
          else {
            setVisible(!valor);
            toast.error("No se pudo guardar, intenta de nuevo");
          }
        });
      }}
    />
  );
}

export const MAX_BIOGRAFIA = 300;

export function BiografiaConContador({ inicial }: { inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  return (
    <div className="flex flex-col gap-1">
      <Textarea id="biografia" name="biografia" rows={4} maxLength={MAX_BIOGRAFIA} value={texto} onChange={(evento) => setTexto(evento.target.value)} />
      <span className="self-end text-xs font-normal text-subtle-foreground tabular-nums">{texto.length} / {MAX_BIOGRAFIA}</span>
    </div>
  );
}

/** Confirmacion fuerte: hay que escribir ELIMINAR (la validacion real la hace el servidor). */
export function EliminarCuenta() {
  const [confirmacion, setConfirmacion] = useState("");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive max-md:h-11 max-md:px-3.5">
          <Trash2 aria-hidden />
          Eliminar cuenta…
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={eliminarCuentaAction} className="flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran tu nombre, correo, foto, perfil y horarios. Tus tareas e historial se conservan para no romper los grupos. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Escribe ELIMINAR para confirmar
            <Input name="confirmacion" autoComplete="off" value={confirmacion} onChange={(evento) => setConfirmacion(evento.target.value)} />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={confirmacion.trim().toLowerCase() !== "eliminar"}>
              Eliminar cuenta
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
