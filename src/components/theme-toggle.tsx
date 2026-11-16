"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

const OPCIONES = [
  { valor: "system", texto: "Sistema", Icono: Monitor },
  { valor: "light", texto: "Claro", Icono: Sun },
  { valor: "dark", texto: "Oscuro", Icono: Moon },
] as const;

/** Grupo de opciones de tema para el menú del usuario; next-themes recuerda la elección. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Tema</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
        {OPCIONES.map(({ valor, texto, Icono }) => (
          <DropdownMenuRadioItem key={valor} value={valor}>
            <Icono className="size-4" aria-hidden />
            {texto}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
