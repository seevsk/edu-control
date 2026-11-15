"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { CampoFecha } from "@/components/ui-app/campo-fecha";

const CAMPO = "flex flex-col gap-1.5 text-[13px] font-medium";

/** Nueva evaluación: si solo se indica el día, cierra a las 11:59 pm de Lima (AGENTS.md 8.2). */
export function FormEvaluacion({ action, cerrarEn }: { action: (formData: FormData) => Promise<void>; cerrarEn: string }) {
  const [conApertura, setConApertura] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className={CAMPO}>
        Nombre
        <Input name="nombre" required maxLength={120} placeholder="Avance 4" autoFocus />
      </label>
      <div className={CAMPO}>
        <span id="cierra-el">Cierra el</span>
        <CampoFecha name="fechaCierre" placeholder="Elegir día" />
        <span className="text-xs font-normal text-subtle-foreground">Cierra a las 11:59 pm de ese día.</span>
      </div>
      <label className="flex items-center justify-between gap-3 text-[13px] font-medium">
        Tiene fecha de apertura
        <Switch checked={conApertura} onCheckedChange={setConApertura} />
      </label>
      {conApertura ? (
        <div className={CAMPO}>
          Abre el
          <CampoFecha name="fechaApertura" placeholder="Elegir día" />
        </div>
      ) : null}
      <label className="flex items-center justify-between gap-3 text-[13px] font-medium">
        Requiere entrega
        <Switch name="requiereEntrega" defaultChecked />
      </label>
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button variant="ghost" asChild><Link href={cerrarEn} scroll={false}>Cancelar</Link></Button>
        <SubmitButton className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Agregar evaluación</SubmitButton>
      </div>
    </form>
  );
}
