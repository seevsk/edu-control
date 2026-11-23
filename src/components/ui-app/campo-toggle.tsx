"use client";

import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const VACIO = "__vacio__";

/** ToggleGroup de seleccion unica que viaja en un <form> nativo con el mismo valor que un <select>. */
export function CampoToggle({
  name,
  opciones,
  defaultValue,
  etiqueta,
}: {
  name: string;
  opciones: { valor: string; texto: string }[];
  defaultValue: string;
  etiqueta: string;
}) {
  const [valor, setValor] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={valor} />
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label={etiqueta}
        value={valor || VACIO}
        // Deseleccionar no esta permitido: siempre queda una opcion elegida.
        onValueChange={(nuevo) => { if (nuevo) setValor(nuevo === VACIO ? "" : nuevo); }}
        className="w-fit"
      >
        {opciones.map((opcion) => (
          <ToggleGroupItem key={opcion.valor || VACIO} value={opcion.valor || VACIO} className="h-8 max-md:h-11 px-3 text-[13px] data-[state=on]:bg-background data-[state=on]:shadow-xs dark:data-[state=on]:bg-accent">
            {opcion.texto}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </>
  );
}
