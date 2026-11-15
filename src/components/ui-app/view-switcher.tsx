import Link from "next/link";
import { KanbanSquare, List } from "lucide-react";
import { cn } from "@/lib/utils";

/** Segmented control Lista / Tablero sincronizado con ?vista=. */
export function ViewSwitcher({ vista, hrefLista, hrefTablero }: { vista: "lista" | "tablero"; hrefLista: string; hrefTablero: string }) {
  const opciones = [
    { valor: "lista", texto: "Lista", href: hrefLista, Icono: List },
    { valor: "tablero", texto: "Tablero", href: hrefTablero, Icono: KanbanSquare },
  ] as const;
  return (
    <div className="flex overflow-hidden rounded-md border border-input" role="group" aria-label="Vista">
      {opciones.map(({ valor, texto, href, Icono }) => (
        <Link
          key={valor}
          href={href}
          scroll={false}
          aria-current={vista === valor ? "true" : undefined}
          className={cn(
            "flex h-7 items-center gap-1.5 px-2.5 text-[13px]",
            vista === valor ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icono className="size-3.5" aria-hidden />
          {texto}
        </Link>
      ))}
    </div>
  );
}
