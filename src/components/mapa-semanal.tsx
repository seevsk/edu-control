import { DIAS_CORTOS, etiquetaHoraEje } from "@/lib/calendario";
import { VENTANA_POR_DEFECTO, type Franja } from "@/lib/disponibilidad";

const PX_POR_HORA = 24;

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

/** Grilla semanal de disponibilidad. Agrupa estados continuos y nunca muestra motivos de ocupacion. */
export function MapaSemanal({
  mapa,
  claseDeFranja,
  describirFranja,
  etiquetaEnFranja,
  leyenda,
  etiqueta,
  titulo,
  descripcion,
}: {
  mapa: Franja[][];
  claseDeFranja: (franja: Franja) => string;
  describirFranja: (franja: Franja) => string;
  etiquetaEnFranja?: (franja: Franja) => string;
  leyenda: { clase: string; texto: string }[];
  etiqueta: string;
  titulo?: string;
  descripcion?: string;
}) {
  const { desdeMin, hastaMin } = VENTANA_POR_DEFECTO;
  const horas = Array.from({ length: (hastaMin - desdeMin) / 60 }, (_, i) => desdeMin / 60 + i);
  const alto = ((hastaMin - desdeMin) / 60) * PX_POR_HORA;

  return (
    <section className="rounded-md border border-border bg-surface" aria-label={etiqueta}>
      {titulo || descripcion ? (
        <div className="border-b border-border px-4 py-3">
          {titulo ? <h2 className="text-sm font-semibold">{titulo}</h2> : null}
          {descripcion ? <p className="mt-0.5 text-xs text-text-muted">{descripcion}</p> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[3.75rem_repeat(7,minmax(0,1fr))] border-b border-border bg-bg/45">
            <div />
            {DIAS_CORTOS.map((dia) => (
              <p
                key={dia}
                className="border-l border-border py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted"
              >
                {dia}
              </p>
            ))}
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

            {mapa.map((franjas, i) => (
              <div key={DIAS_CORTOS[i]} className="relative border-l border-border" style={{ height: alto }}>
                {horas.map((hora, indice) => (
                  <span
                    key={hora}
                    className="pointer-events-none absolute inset-x-0 border-t border-border/70"
                    style={{ top: indice * PX_POR_HORA }}
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
                      className={`group absolute inset-x-0.5 z-10 flex items-start justify-center border-y border-surface/35 px-1 py-0.5 transition-[filter] hover:z-20 hover:brightness-95 focus:z-20 ${claseDeFranja(franja)}`}
                      style={{ top, height: Math.max(altoBloque, 2) }}
                    >
                      {etiquetaEnFranja && altoBloque >= 24 ? (
                        <span className="text-[10px] font-semibold leading-4 tabular-nums">{etiquetaEnFranja(franja)}</span>
                      ) : null}
                      <span className="pointer-events-none absolute left-1/2 top-1/2 z-30 hidden w-max max-w-64 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-brand-ink px-2 py-1.5 text-left text-[11px] font-normal leading-4 text-white shadow-lg group-hover:block group-focus:block">
                        {detalle}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-text-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {leyenda.map((nivel) => (
            <span key={nivel.texto} className="flex items-center gap-1.5">
              <span className={`size-3 rounded-[2px] ${nivel.clase}`} aria-hidden />
              {nivel.texto}
            </span>
          ))}
        </div>
        <span>Selecciona una franja con el cursor o el teclado para ver el detalle.</span>
      </div>
    </section>
  );
}
