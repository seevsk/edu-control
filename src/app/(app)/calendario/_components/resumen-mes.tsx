import Link from "next/link";
import { diaMesCorto, formatearDuracion, type CategoriaCalendario } from "@/lib/calendario";
import type { Entrega, ReunionFecha } from "./items";

const CATEGORIAS: { key: CategoriaCalendario; etiqueta: string; punto: string }[] = [
  { key: "clases", etiqueta: "Clases", punto: "bg-cat-clases" },
  { key: "laboral", etiqueta: "Laboral", punto: "bg-cat-laboral" },
  { key: "fam", etiqueta: "Familiar / Personal", punto: "bg-cat-fam" },
];

export function ResumenMes({
  mesISO,
  hoyISO,
  entregas,
  reuniones,
  minutosPorCategoria,
}: {
  mesISO: string;
  hoyISO: string;
  entregas: Entrega[];
  reuniones: ReunionFecha[];
  minutosPorCategoria: Record<CategoriaCalendario, number>;
}) {
  const entregasDelMes = entregas.filter((entrega) => entrega.diaISO.startsWith(mesISO));
  const reunionesDelMes = reuniones.filter((reunion) => reunion.diaISO.startsWith(mesISO));
  const evaluaciones = entregasDelMes.filter((entrega) => entrega.tipo === "evaluacion").length;
  const tareas = entregasDelMes.filter((entrega) => entrega.tipo === "tarea").length;
  const proximos = [
    ...entregasDelMes.map((entrega) => ({ ...entrega, etiqueta: entrega.tipo === "evaluacion" ? "Evaluación" : "Tarea" })),
    ...reunionesDelMes.map((reunion) => ({ ...reunion, etiqueta: "Reunión" })),
  ]
    .filter((evento) => evento.diaISO >= hoyISO)
    .sort((a, b) => a.diaISO.localeCompare(b.diaISO) || a.inicioMin - b.inicioMin)
    .slice(0, 5);

  return (
    <aside className="hidden min-w-0 flex-col gap-3 xl:flex" aria-label="Resumen del mes">
      <section className="rounded-md border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="text-sm font-semibold">Resumen del mes</h2>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-sm bg-danger/[0.06] px-2 py-2">
            <dt className="text-[10px] text-text-muted">Evaluaciones</dt>
            <dd className="mt-0.5 text-lg font-semibold text-danger">{evaluaciones}</dd>
          </div>
          <div className="rounded-sm bg-primary-soft px-2 py-2">
            <dt className="text-[10px] text-text-muted">Tareas</dt>
            <dd className="mt-0.5 text-lg font-semibold text-primary">{tareas}</dd>
          </div>
          <div className="rounded-sm bg-cat-reunion-bg px-2 py-2">
            <dt className="text-[10px] text-text-muted">Reuniones</dt>
            <dd className="mt-0.5 text-lg font-semibold text-cat-reunion-fg">{reunionesDelMes.length}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-md border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="text-sm font-semibold">Tiempo semanal</h2>
        <dl className="mt-3 space-y-2.5">
          {CATEGORIAS.map((categoria) => (
            <div key={categoria.key} className="flex items-center gap-2 text-xs">
              <span className={`size-2 rounded-full ${categoria.punto}`} aria-hidden />
              <dt className="min-w-0 flex-1 truncate text-text-muted">{categoria.etiqueta}</dt>
              <dd className="font-medium tabular-nums">{formatearDuracion(minutosPorCategoria[categoria.key])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-md border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="text-sm font-semibold">Próximos eventos</h2>
        {proximos.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-text-muted">No quedan entregas ni reuniones este mes.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {proximos.map((evento) => (
              <li key={evento.clave}>
                <Link href={evento.href} className="block py-2.5 hover:text-primary">
                  <span className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
                    <span>{evento.etiqueta}</span>
                    <span className="shrink-0 tabular-nums">{diaMesCorto(evento.diaISO)} · {evento.hora}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-text">{evento.titulo}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
