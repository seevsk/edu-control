import Link from "next/link";
import { DIAS_CORTOS, DIAS_LARGOS, diaMesCorto, etiquetaHoraEje, etiquetaMinutos } from "@/lib/calendario";
import { VENTANA_POR_DEFECTO, type Franja } from "@/lib/disponibilidad";

const PX_POR_HORA = 40;

export type EventoMapaSemanal = {
  clave: string;
  diaSemana: number;
  inicioMin: number;
  finMin: number;
  titulo: string;
  subtitulo?: string | null;
  href?: string | null;
};

function mismosOcupados(a: number[], b: number[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** Une medias horas contiguas cuando la disponibilidad corresponde a las mismas personas. */
function agruparFranjas(franjas: Franja[]): Franja[] {
  const bloques: Franja[] = [];

  for (const franja of franjas) {
    const anterior = bloques.at(-1);
    if (anterior && anterior.finMin === franja.inicioMin && mismosOcupados(anterior.ocupados, franja.ocupados)) {
      anterior.finMin = franja.finMin;
      continue;
    }

    bloques.push({ ...franja, ocupados: [...franja.ocupados] });
  }

  return bloques;
}

function TarjetaReunion({ evento, movil = false }: { evento: EventoMapaSemanal; movil?: boolean }) {
  const rango = `${etiquetaMinutos(evento.inicioMin)} – ${etiquetaMinutos(evento.finMin)}`;
  const descripcion = `Reunión: ${evento.titulo} · ${rango}${evento.subtitulo ? ` · ${evento.subtitulo}` : ""}`;
  const contenido = movil ? (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-cat-reunion-fg">
        <span className="size-1.5 shrink-0 rounded-full bg-cat-reunion" aria-hidden />
        Reunión
        <span className="ml-auto shrink-0 tabular-nums text-text-muted">{rango}</span>
      </span>
      <span className="mt-0.5 block truncate text-sm font-semibold text-text">{evento.titulo}</span>
      {evento.subtitulo ? <span className="mt-0.5 block truncate text-xs text-text-muted">{evento.subtitulo}</span> : null}
    </>
  ) : (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="size-1.5 shrink-0 rounded-full bg-cat-reunion" aria-hidden />
        <span className="truncate text-[11px] font-semibold text-text">{evento.titulo}</span>
      </span>
      <span className="mt-0.5 block truncate text-[10px] tabular-nums text-cat-reunion-fg">{rango}</span>
    </>
  );
  const clase = `block min-w-0 rounded-sm border border-cat-reunion-borde bg-cat-reunion-bg px-1.5 py-1 text-left shadow-sm transition-colors duration-150 hover:border-cat-reunion ${
    movil ? "px-2 py-2" : "absolute inset-x-1 inset-y-0 z-30 overflow-hidden"
  }`;

  if (!evento.href) return <div className={clase} title={descripcion}>{contenido}</div>;
  return <Link href={evento.href} className={clase} title={descripcion} aria-label={descripcion}>{contenido}</Link>;
}

/** Grilla de disponibilidad con el mismo lenguaje visual del calendario general. */
export function MapaSemanal({
  mapa,
  claseDeFranja,
  describirFranja,
  etiquetaEnFranja,
  leyenda,
  etiqueta,
  titulo,
  descripcion,
  fechasDias,
  hoyISO,
  ahoraMin,
  eventos = [],
}: {
  mapa: Franja[][];
  claseDeFranja: (franja: Franja) => string;
  describirFranja: (franja: Franja) => string;
  etiquetaEnFranja?: (franja: Franja) => string;
  leyenda: { clase: string; texto: string }[];
  etiqueta: string;
  titulo?: string;
  descripcion?: string;
  fechasDias?: string[];
  hoyISO?: string;
  ahoraMin?: number;
  eventos?: EventoMapaSemanal[];
}) {
  const { desdeMin, hastaMin } = VENTANA_POR_DEFECTO;
  const horas = Array.from({ length: (hastaMin - desdeMin) / 60 }, (_, i) => desdeMin / 60 + i);
  const alto = ((hastaMin - desdeMin) / 60) * PX_POR_HORA;
  const lineaAhora = ahoraMin !== undefined && ahoraMin >= desdeMin && ahoraMin <= hastaMin
    ? ((ahoraMin - desdeMin) / 60) * PX_POR_HORA
    : null;

  return (
    <section
      className="overflow-hidden rounded-md border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      aria-label={etiqueta}
    >
      {titulo || descripcion ? (
        <div className="border-b border-border px-4 py-3">
          {titulo ? <h2 className="text-sm font-semibold">{titulo}</h2> : null}
          {descripcion ? <p className="mt-0.5 text-xs text-text-muted">{descripcion}</p> : null}
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[3.75rem_repeat(7,minmax(0,1fr))] border-b border-border bg-bg/45">
            <div />
            {DIAS_CORTOS.map((dia, indice) => {
              const fechaISO = fechasDias?.[indice];
              const esHoy = fechaISO === hoyISO;
              const mes = fechaISO ? diaMesCorto(fechaISO).split(" ")[1] : null;
              return (
                <div
                  key={dia}
                  className={`border-l border-border px-1 py-2 text-center ${esHoy ? "bg-primary-soft/45" : ""}`}
                  aria-current={esHoy ? "date" : undefined}
                >
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${esHoy ? "text-primary" : "text-text-muted"}`}>{dia}</p>
                  {fechaISO ? (
                    <p className="mt-0.5 flex items-center justify-center gap-1">
                      <span className={`grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums ${esHoy ? "bg-primary text-white" : "text-text"}`}>
                        {Number(fechaISO.slice(8))}
                      </span>
                      <span className="text-[10px] text-text-muted">{mes}</span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-[3.75rem_repeat(7,minmax(0,1fr))]">
            <div className="relative bg-bg/25" style={{ height: alto }} aria-hidden>
              {horas.map((hora, i) => (
                <span
                  key={hora}
                  className={`absolute right-2 text-[10px] tabular-nums text-text-muted ${i === 0 ? "top-1" : "-translate-y-1/2"}`}
                  style={i === 0 ? undefined : { top: i * PX_POR_HORA }}
                >
                  {etiquetaHoraEje(hora)}
                </span>
              ))}
            </div>

            {mapa.map((franjas, indice) => {
              const fechaISO = fechasDias?.[indice];
              const esHoy = fechaISO === hoyISO;
              const eventosDelDia = eventos.filter((evento) => evento.diaSemana === indice + 1);
              return (
                <div
                  key={DIAS_CORTOS[indice]}
                  className={`relative border-l border-border ${esHoy ? "bg-primary-soft/20" : ""}`}
                  style={{ height: alto }}
                >
                  {horas.map((hora, horaIndice) => (
                    <span
                      key={hora}
                      className="pointer-events-none absolute inset-x-0 border-t border-border/70"
                      style={{ top: horaIndice * PX_POR_HORA }}
                      aria-hidden
                    />
                  ))}

                  {agruparFranjas(franjas).map((franja) => {
                    const top = ((franja.inicioMin - desdeMin) / 60) * PX_POR_HORA;
                    const altoBloque = ((franja.finMin - franja.inicioMin) / 60) * PX_POR_HORA;
                    const detalle = describirFranja(franja);
                    return (
                      <div
                        key={franja.inicioMin}
                        tabIndex={0}
                        role="img"
                        aria-label={detalle}
                        className={`group absolute inset-x-0.5 z-10 flex items-start justify-center rounded-[2px] border-y border-surface/35 px-1 py-0.5 transition-[filter] hover:z-20 hover:brightness-95 focus:z-20 ${claseDeFranja(franja)}`}
                        style={{ top, height: Math.max(altoBloque, 2) }}
                      >
                        {etiquetaEnFranja && altoBloque >= 24 ? (
                          <span className="text-[10px] font-semibold leading-4 tabular-nums">{etiquetaEnFranja(franja)}</span>
                        ) : null}
                        <span className="pointer-events-none absolute left-1/2 top-1/2 z-40 hidden w-max max-w-64 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-brand-ink px-2 py-1.5 text-left text-[11px] font-normal leading-4 text-white shadow-lg group-hover:block group-focus:block">
                          {detalle}
                        </span>
                      </div>
                    );
                  })}

                  {eventosDelDia.map((evento) => {
                    const inicio = Math.max(evento.inicioMin, desdeMin);
                    const fin = Math.min(evento.finMin, hastaMin);
                    if (fin <= inicio) return null;
                    return (
                      <div
                        key={evento.clave}
                        className="absolute inset-x-0 z-30"
                        style={{
                          top: ((inicio - desdeMin) / 60) * PX_POR_HORA + 1,
                          height: Math.max(((fin - inicio) / 60) * PX_POR_HORA - 2, 24),
                        }}
                      >
                        <TarjetaReunion evento={evento} />
                      </div>
                    );
                  })}

                  {esHoy && lineaAhora !== null ? (
                    <div className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-danger" style={{ top: lineaAhora }} aria-hidden>
                      <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-danger" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ol className="flex flex-col divide-y divide-border md:hidden" aria-label="Agenda de disponibilidad">
        {mapa.map((franjas, indice) => {
          const fechaISO = fechasDias?.[indice];
          const esHoy = fechaISO === hoyISO;
          const eventosDelDia = eventos.filter((evento) => evento.diaSemana === indice + 1);
          return (
            <li key={DIAS_CORTOS[indice]} className={esHoy ? "bg-primary-soft/20" : ""} aria-current={esHoy ? "date" : undefined}>
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <p className="text-sm font-semibold">
                  {DIAS_LARGOS[indice]}
                  {fechaISO ? <span className="ml-1 font-normal text-text-muted">{diaMesCorto(fechaISO)}</span> : null}
                </p>
                {esHoy ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white">Hoy</span> : null}
              </div>

              {eventosDelDia.length > 0 ? (
                <div className="flex flex-col gap-1.5 border-b border-border bg-bg/45 p-2">
                  {eventosDelDia.map((evento) => <TarjetaReunion key={evento.clave} evento={evento} movil />)}
                </div>
              ) : null}

              <ul className="divide-y divide-border/70">
                {agruparFranjas(franjas).map((franja) => {
                  const detalle = describirFranja(franja);
                  return (
                    <li key={franja.inicioMin} className="flex items-center gap-3 px-3 py-2" title={detalle}>
                      <span className="w-[7.25rem] shrink-0 text-xs tabular-nums text-text-muted">
                        {etiquetaMinutos(franja.inicioMin)} – {etiquetaMinutos(franja.finMin)}
                      </span>
                      <span className={`h-7 w-1 shrink-0 rounded-full ${claseDeFranja(franja)}`} aria-hidden />
                      <span className="min-w-0 text-xs font-medium text-text">
                        {etiquetaEnFranja ? `${etiquetaEnFranja(franja)} libres` : detalle}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-text-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {leyenda.map((nivel) => (
            <span key={nivel.texto} className="flex items-center gap-1.5">
              <span className={`size-3 rounded-[2px] ${nivel.clase}`} aria-hidden />
              {nivel.texto}
            </span>
          ))}
        </div>
        <span className="hidden md:inline">Selecciona una franja con el cursor o el teclado para ver el detalle.</span>
      </div>
    </section>
  );
}
