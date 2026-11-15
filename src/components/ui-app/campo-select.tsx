"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix no admite "" como valor de un item; este centinela representa "ninguno" y viaja como "". */
const VACIO = "__vacio__";

export interface OpcionSelect {
  valor: string;
  texto: string;
}

/**
 * Select de shadcn que se envia en un <form> nativo: el valor real (incluido "") viaja en un input oculto,
 * asi las Server Actions y la validacion Zod reciben exactamente lo mismo que con un <select>.
 */
export function CampoSelect({
  name,
  opciones,
  defaultValue = "",
  placeholder,
  required,
  className,
  id,
}: {
  name: string;
  opciones: OpcionSelect[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
}) {
  const [valor, setValor] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={valor} />
      <Select value={valor === "" ? (opciones.some((opcion) => opcion.valor === "") ? VACIO : undefined) : valor} onValueChange={(nuevo) => setValor(nuevo === VACIO ? "" : nuevo)} required={required}>
        <SelectTrigger id={id} className={cn("w-full font-normal", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((opcion) => (
            <SelectItem key={opcion.valor || VACIO} value={opcion.valor || VACIO}>
              {opcion.texto}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
