import { DIAS_CORTOS, etiquetaHoraEje } from "@/lib/calendario";
import { VENTANA_POR_DEFECTO, type Franja } from "@/lib/disponibilidad";

const PX_FRANJA = 14;

/** Grilla semanal de franjas (ocupado/libre o nivel de disponibilidad). Sin titulos ni motivos. */
export function MapaSemanal({
  mapa,
  claseDeFranja,
  describirFranja,
  leyenda,
  etiqueta,
}: {
  mapa: Franja[][];
  claseDeFranja: (franja: Franja) => string;
  describirFranja: (franja: Franja) => string;
  leyenda: { clase: string; texto: string }[];
  etiqueta: string;
}) {
  const { desdeMin, hastaMin, pasoMin } = VENTANA_POR_DEFECTO;
  const horas = Array.from({ length: (hastaMin - desdeMin) / 60 }, (_, i) => desdeMin / 60 + i);
  const alto = ((hastaMin - desdeMin) / pasoMin) * PX_FRANJA;

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface" aria-label={etiqueta}>
      <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-border">
        <div />
        {DIAS_CORTOS.map((dia) => (
          <p key={dia} className="border-l border-border py-2 text-center text-[11px] font-medium uppercase tracking-wide text-text-muted">
            {dia}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
        <div className="relative" style={{ height: alto }} aria-hidden>
          {horas.map((hora, i) => (
            <span
              key={hora}
              className={`absolute right-2 text-[10px] tabular-nums text-text-muted ${i === 0 ? "top-0.5" : "-translate-y-1/2"}`}
              style={i === 0 ? undefined : { top: i * (60 / pasoMin) * PX_FRANJA }}
            >
              {etiquetaHoraEje(hora)}
            </span>
          ))}
        </div>

        {mapa.map((franjas, i) => (
          <div key={DIAS_CORTOS[i]} className="flex flex-col gap-px border-l border-border p-px" style={{ height: alto }}>
            {franjas.map((franja) => (
              <div
                key={franja.inicioMin}
                className={`flex-1 rounded-[2px] ${claseDeFranja(franja)}`}
                title={describirFranja(franja)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-3 py-2.5 text-xs text-text-muted">
        {leyenda.map((nivel) => (
          <span key={nivel.texto} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-[2px] ${nivel.clase}`} aria-hidden />
            {nivel.texto}
          </span>
        ))}
      </div>
    </section>
  );
}
