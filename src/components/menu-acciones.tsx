import { IconMas } from "./icons";

/** Menu "..." sin JS (details/summary): abre un panel con acciones (editar, eliminar, etc). */
export function MenuAcciones({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <details className="group relative">
      <summary
        aria-label={etiqueta}
        className="flex size-7 cursor-pointer list-none items-center justify-center rounded-md text-text-muted hover:bg-bg [&::-webkit-details-marker]:hidden"
      >
        <IconMas className="size-4" aria-hidden />
      </summary>
      <div className="absolute right-0 z-10 mt-1 flex w-44 flex-col overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg">
        {children}
      </div>
    </details>
  );
}
