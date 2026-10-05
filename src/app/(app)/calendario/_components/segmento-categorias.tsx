import Link from "next/link";
import { CATEGORIAS_CALENDARIO, formatearDuracion, type CategoriaCalendario } from "@/lib/calendario";
import { ESTILO_CATEGORIA } from "./items";

export type VistaCalendario = CategoriaCalendario | "todo";

export function SegmentoCategorias({
  activa,
  semanaISO,
  minutosPorCategoria,
}: {
  activa: VistaCalendario;
  semanaISO: string;
  minutosPorCategoria: Record<CategoriaCalendario, number>;
}) {
  const opciones: { key: VistaCalendario; label: string }[] = [{ key: "todo", label: "Todo" }, ...CATEGORIAS_CALENDARIO];

  return (
    <nav aria-label="Filtrar por categoría" className="max-w-full overflow-x-auto">
      <div className="flex w-max divide-x divide-border-strong overflow-hidden rounded-md border border-border-strong bg-surface text-sm">
        {opciones.map((opcion) => {
          const activo = opcion.key === activa;
          const minutos = opcion.key === "todo" ? 0 : minutosPorCategoria[opcion.key];
          return (
            <Link
              key={opcion.key}
              href={`/calendario?semana=${semanaISO}&vista=${opcion.key}`}
              aria-current={activo ? "page" : undefined}
              className={`flex items-center gap-2 whitespace-nowrap px-3 py-1.5 transition-colors duration-150 ${
                activo ? "bg-primary-soft font-medium text-primary" : "text-text hover:bg-bg"
              }`}
            >
              {opcion.key !== "todo" ? (
                <span className={`size-2 shrink-0 rounded-full ${ESTILO_CATEGORIA[opcion.key].punto}`} aria-hidden />
              ) : null}
              {opcion.label}
              {minutos > 0 ? (
                <span
                  className={`text-xs font-normal tabular-nums ${activo ? "text-primary" : "text-text-muted"}`}
                  title={`${formatearDuracion(minutos)} por semana`}
                >
                  {formatearDuracion(minutos)}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
