"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPCIONES = [
  { valor: "system", texto: "Sistema" },
  { valor: "light", texto: "Claro" },
  { valor: "dark", texto: "Oscuro" },
];

const sinSuscripcion = () => () => {};

/** Tema de la app (next-themes lo recuerda). Antes de montar no se conoce el tema guardado. */
export function SelectorTema({ id }: { id?: string }) {
  const { theme, setTheme } = useTheme();
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  return (
    <Select value={montado ? theme ?? "system" : undefined} onValueChange={setTheme}>
      <SelectTrigger id={id} aria-label="Apariencia" className="h-9 w-[124px] text-sm">
        <SelectValue placeholder="Sistema" />
      </SelectTrigger>
      <SelectContent align="end">
        {OPCIONES.map((opcion) => (
          <SelectItem key={opcion.valor} value={opcion.valor}>{opcion.texto}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
