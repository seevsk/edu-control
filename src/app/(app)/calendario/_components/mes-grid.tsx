import Link from "next/link";
import { DIAS_CORTOS, diaMesCorto, diaSemanaISO, etiquetaFechaLarga } from "@/lib/calendario";
import type { Entrega, ItemCalendario, ReunionFecha, TipoItem } from "./items";

type TipoEventoMes = TipoItem | Entrega["tipo"];

type EventoMes = {
  clave: string;
  tipo: TipoEventoMes;
  titulo: string;
  contexto: string | null;
  hora: string;
  orden: number;
  href: string | null;
};

const ESTILOS: Record<TipoEventoMes, { etiqueta: string; punto: string; tarjeta: string; etiquetaColor: string }> = {
  clases: {
    etiqueta: "Clase",
    punto: "bg-cat-clases",
    tarjeta: "border-cat-clases-borde bg-cat-clases-bg/55 hover:border-cat-clases",
    etiquetaColor: "text-cat-clases-fg",
  },
  laboral: {
    etiqueta: "Laboral",
    punto: "bg-cat-laboral",
    tarjeta: "border-cat-laboral-borde bg-cat-laboral-bg/55 hover:border-cat-laboral",
    etiquetaColor: "text-cat-laboral-fg",
  },
  fam: {
    etiqueta: "Personal",
    punto: "bg-cat-fam",
    tarjeta: "border-cat-fam-borde bg-cat-fam-bg/55 hover:border-cat-fam",
    etiquetaColor: "text-cat-fam-fg",
  },
  reunion: {
    etiqueta: "Reunión",
    punto: "bg-cat-reunion",
    tarjeta: "border-cat-reunion-borde bg-cat-reunion-bg/55 hover:border-cat-reunion",
    etiquetaColor: "text-cat-reunion-fg",
  },
  evaluacion: {
    etiqueta: "Evaluación",
    punto: "bg-danger",
    tarjeta: "border-danger/25 bg-danger/[0.055] hover:border-danger/50",
    etiquetaColor: "text-danger",
  },
  tarea: {
    etiqueta: "Tarea",
    punto: "bg-primary",
    tarjeta: "border-primary/25 bg-primary-soft/70 hover:border-primary/50",
    etiquetaColor: "text-primary",
  },
};

function eventosDelDia(
  diaISO: string,
  items: ItemCalendario[],
  entregas: Entrega[],
  reuniones: ReunionFecha[],
): EventoMes[] {
  const diaSemana = diaSemanaISO(diaISO);
  const recurrentes: EventoMes[] = items
    .filter((item) => item.diaSemana === diaSemana && !item.sigueDelDiaAnterior)
    .map((item) => ({
      clave: `${diaISO}-${item.clave}`,
      tipo: item.categoria,
      titulo: item.titulo,
      contexto: item.subtitulo,
      hora: item.horaInicio,
      orden: item.inicioMin,
      href: item.href,
    }));
  const entregasDelDia: EventoMes[] = entregas
    .filter((entrega) => entrega.diaISO === diaISO)
    .map((entrega) => ({
      clave: entrega.clave,
      tipo: entrega.tipo,
      titulo: entrega.titulo,
      contexto: entrega.contexto,
      hora: entrega.hora,
      orden: entrega.inicioMin,
      href: entrega.href,
    }));
  const reunionesDelDia: EventoMes[] = reuniones
    .filter((reunion) => reunion.diaISO === diaISO)
    .map((reunion) => ({
      clave: reunion.clave,
      tipo: "reunion",
      titulo: reunion.titulo,
      contexto: reunion.contexto,
      hora: reunion.hora,
      orden: reunion.inicioMin,
      href: reunion.href,
    }));

  return [...recurrentes, ...entregasDelDia, ...reunionesDelDia].sort(
    (a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, "es"),
  );
}

function TarjetaEventoMes({ evento, amplia = false }: { evento: EventoMes; amplia?: boolean }) {
  const estilo = ESTILOS[evento.tipo];
  const descripcion = `${estilo.etiqueta}: ${evento.titulo} · ${evento.hora}${evento.contexto ? ` · ${evento.contexto}` : ""}`;
  const contenido = (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`size-1.5 shrink-0 rounded-full ${estilo.punto}`} aria-hidden />
        <span className={`truncate text-[10px] font-medium ${estilo.etiquetaColor}`}>{estilo.etiqueta}</span>
        <span className="ml-auto shrink-0 text-[10px] tabular-nums text-text-muted">{evento.hora}</span>
      </span>
      <span className={`mt-0.5 block font-medium leading-snug text-text ${amplia ? "text-sm" : "truncate text-[11px]"}`}>
        {evento.titulo}
      </span>
      {amplia && evento.contexto ? <span className="mt-0.5 block truncate text-xs text-text-muted">{evento.contexto}</span> : null}
    </>
  );
  const clase = `block min-w-0 rounded-sm border px-1.5 py-1 transition-colors duration-150 ${estilo.tarjeta}`;

  if (!evento.href) return <div className={clase} title={descripcion}>{contenido}</div>;
  return <Link href={evento.href} className={clase} title={descripcion} aria-label={descripcion}>{contenido}</Link>;
}

export function MesGrid({
  dias,
  mesISO,
  hoyISO,
  items,
  entregas,
  reuniones,
}: {
  dias: string[];
  mesISO: string;
  hoyISO: string;
  items: ItemCalendario[];
  entregas: Entrega[];
  reuniones: ReunionFecha[];
}) {
  const eventosPorDia = new Map(dias.map((dia) => [dia, eventosDelDia(dia, items, entregas, reuniones)]));
  const diasDelMesConEventos = dias.filter((dia) => dia.startsWith(mesISO) && (eventosPorDia.get(dia)?.length ?? 0) > 0);

  return (
    <>
      <section
        aria-label="Calendario mensual"
        className="hidden overflow-hidden rounded-md border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:block"
      >
        <div className="grid grid-cols-7 border-b border-border bg-bg/70">
          {DIAS_CORTOS.map((dia) => (
            <div key={dia} className="border-l border-border px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted first:border-l-0">
              {dia}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {dias.map((diaISO, indice) => {
            const esHoy = diaISO === hoyISO;
            const esDelMes = diaISO.startsWith(mesISO);
            const eventos = eventosPorDia.get(diaISO) ?? [];
            const visibles = eventos.slice(0, 3);
            const adicionales = eventos.slice(3);
            return (
              <article
                key={diaISO}
                aria-current={esHoy ? "date" : undefined}
                className={`min-h-36 border-b border-l border-border p-1.5 first:border-l-0 ${
                  indice % 7 === 0 ? "border-l-0" : ""
                } ${esDelMes ? "bg-surface" : "bg-bg/55 text-text-muted"} ${esHoy ? "ring-1 ring-inset ring-primary/50" : ""}`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span
                    className={`grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums ${
                      esHoy ? "bg-primary text-white" : esDelMes ? "text-text" : "text-text-muted"
                    }`}
                  >
                    {Number(diaISO.slice(8))}
                  </span>
                  {!esDelMes && Number(diaISO.slice(8)) <= 7 ? (
                    <span className="text-[10px] uppercase text-text-muted">{diaMesCorto(diaISO).split(" ")[1]}</span>
                  ) : null}
                </div>

                <div className={`flex flex-col gap-1 ${esDelMes ? "" : "opacity-60"}`}>
                  {visibles.map((evento) => <TarjetaEventoMes key={evento.clave} evento={evento} />)}
                  {adicionales.length > 0 ? (
                    <details className="group/mas">
                      <summary className="cursor-pointer list-none rounded-sm px-1 py-0.5 text-[11px] font-medium text-primary hover:bg-primary-soft [&::-webkit-details-marker]:hidden">
                        <span className="group-open/mas:hidden">+{adicionales.length} más</span>
                        <span className="hidden group-open/mas:inline">Mostrar menos</span>
                      </summary>
                      <div className="mt-1 flex flex-col gap-1">
                        {adicionales.map((evento) => <TarjetaEventoMes key={evento.clave} evento={evento} />)}
                      </div>
                    </details>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="md:hidden" aria-label="Agenda mensual">
        {diasDelMesConEventos.length === 0 ? (
          <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
            No tienes eventos en este mes.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {diasDelMesConEventos.map((diaISO) => {
              const esHoy = diaISO === hoyISO;
              const eventos = eventosPorDia.get(diaISO) ?? [];
              return (
                <li key={diaISO} className={`overflow-hidden rounded-md border bg-surface ${esHoy ? "border-primary/50" : "border-border"}`}>
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <p className="text-sm font-semibold">{etiquetaFechaLarga(diaISO)}</p>
                    {esHoy ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white">Hoy</span> : null}
                  </div>
                  <div className="flex flex-col gap-1.5 p-2">
                    {eventos.map((evento) => <TarjetaEventoMes key={evento.clave} evento={evento} amplia />)}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
