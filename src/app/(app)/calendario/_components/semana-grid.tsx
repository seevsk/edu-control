import Link from "next/link";
import { DIAS_CORTOS, distribuirSolapes, etiquetaHoraEje, horaInicioVisible, type ConColumna } from "@/lib/calendario";
import { ESTILO_CATEGORIA, rangoDe, type Entrega, type ItemCalendario } from "./items";
import { ChipEntrega } from "./chip-entrega";

const PX_POR_HORA = 48;
// El mismo gutter de scrollbar en cabecera y cuerpo mantiene las columnas alineadas.
const COLUMNAS = "grid grid-cols-[3.75rem_repeat(7,minmax(0,1fr))] [scrollbar-gutter:stable]";

export function SemanaGrid({
  dias,
  hoyISO,
  ahoraMin,
  items,
  entregas,
  mensajeVacio,
}: {
  dias: string[];
  hoyISO: string;
  ahoraMin: number;
  items: ItemCalendario[];
  entregas: Entrega[];
  mensajeVacio: string;
}) {
  const desde = horaInicioVisible(items);
  const desdeMin = desde * 60;
  const alto = (24 - desde) * PX_POR_HORA;
  const horas = Array.from({ length: 24 - desde }, (_, i) => desde + i);
  const lineaAhora = ahoraMin >= desdeMin ? ((ahoraMin - desdeMin) / 60) * PX_POR_HORA : null;

  return (
    <div className="hidden overflow-hidden rounded-md border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:block">
      <div className={`${COLUMNAS} overflow-hidden border-b border-border`}>
        <div />
        {dias.map((diaISO, i) => {
          const esHoy = diaISO === hoyISO;
          return (
            <div key={diaISO} className="border-l border-border px-1 py-2 text-center" aria-current={esHoy ? "date" : undefined}>
              <p className={`text-[11px] font-medium uppercase tracking-wide ${esHoy ? "text-primary" : "text-text-muted"}`}>
                {DIAS_CORTOS[i]}
              </p>
              <p
                className={`mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums ${
                  esHoy ? "bg-primary text-white" : "text-text"
                }`}
              >
                {Number(diaISO.slice(8))}
              </p>
            </div>
          );
        })}
      </div>

      {entregas.length > 0 ? (
        <div className={`${COLUMNAS} overflow-hidden border-b border-border bg-bg`}>
          <p className="px-2 py-2 text-right text-[10px] font-medium leading-tight text-text-muted">Entregas</p>
          {dias.map((diaISO) => (
            <div key={diaISO} className="flex min-w-0 flex-col gap-1 border-l border-border p-1">
              {entregas
                .filter((entrega) => entrega.diaISO === diaISO)
                .map((entrega) => (
                  <ChipEntrega key={entrega.clave} entrega={entrega} />
                ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <div className={`${COLUMNAS} max-h-[min(46rem,calc(100dvh-15rem))] min-h-80 overflow-y-auto`}>
          <div className="relative" style={{ height: alto }} aria-hidden>
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

          {dias.map((diaISO, i) => {
            const esHoy = diaISO === hoyISO;
            const delDia = distribuirSolapes(items.filter((item) => item.diaSemana === i + 1));
            return (
              <div
                key={diaISO}
                className={`relative border-l border-border ${esHoy ? "bg-primary-soft/35" : ""}`}
                style={{
                  height: alto,
                  backgroundImage: "linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)",
                  backgroundSize: `100% ${PX_POR_HORA}px`,
                }}
              >
                {delDia.map((item) => (
                  <BloqueEvento key={item.clave} item={item} desdeMin={desdeMin} />
                ))}
                {esHoy && lineaAhora !== null ? (
                  <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-danger" style={{ top: lineaAhora }} aria-hidden>
                    <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-danger" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {items.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
            <p className="max-w-sm rounded-md border border-border bg-surface px-4 py-3 text-center text-sm text-text-muted shadow-sm">
              {mensajeVacio}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BloqueEvento({ item, desdeMin }: { item: ConColumna<ItemCalendario>; desdeMin: number }) {
  const top = ((item.inicioMin - desdeMin) / 60) * PX_POR_HORA;
  const alto = Math.max(((item.finMin - item.inicioMin) / 60) * PX_POR_HORA, 22);
  const estilo = ESTILO_CATEGORIA[item.categoria];
  const rango = rangoDe(item);
  const descripcion = [item.titulo, rango, item.subtitulo].filter(Boolean).join(" · ");
  // Cada parte muestra la hora real que le toca: la que empieza el dia, su inicio; la que
  // termina al dia siguiente, su fin.
  const inicio = item.sigueDelDiaAnterior ? null : item.horaInicio;
  const fin = item.sigueAlDiaSiguiente ? null : item.horaFin;

  let contenido: React.ReactNode;
  if (alto < 44) {
    contenido = (
      <span className="block truncate leading-tight">
        <span className="font-semibold">{item.titulo}</span>{" "}
        <span className="tabular-nums opacity-85">{inicio ?? fin}</span>
      </span>
    );
  } else if (alto >= 120) {
    contenido = (
      <span className="flex h-full flex-col justify-between">
        <span className="block">
          {inicio ? <span className="block font-medium tabular-nums">{inicio}</span> : null}
          <span className="mt-0.5 block font-semibold leading-snug line-clamp-3">{item.titulo}</span>
          {item.subtitulo ? <span className="mt-0.5 block truncate opacity-85">{item.subtitulo}</span> : null}
        </span>
        {fin ? <span className="block font-medium tabular-nums">{fin}</span> : null}
      </span>
    );
  } else {
    contenido = (
      <>
        <span className={`block font-semibold leading-snug ${alto < 84 ? "line-clamp-2" : "line-clamp-3"}`}>{item.titulo}</span>
        <span className="mt-0.5 block truncate tabular-nums opacity-85">{rango}</span>
      </>
    );
  }

  const clase = `absolute overflow-hidden border px-1.5 py-1 text-[11px] transition-colors duration-150 focus-visible:z-20 ${estilo.bloque} ${
    item.href ? estilo.enlace : ""
  } ${item.sigueAlDiaSiguiente ? "rounded-t-sm border-b-0" : item.sigueDelDiaAnterior ? "rounded-b-sm border-t-0" : "rounded-sm"}`;
  const posicion = {
    top: item.sigueDelDiaAnterior ? top : top + 1,
    height: item.sigueAlDiaSiguiente || item.sigueDelDiaAnterior ? alto - 1 : alto - 2,
    left: `calc(${(item.columna / item.columnas) * 100}% + 2px)`,
    width: `calc(${100 / item.columnas}% - 4px)`,
  };

  if (!item.href) {
    return (
      <div className={clase} style={posicion} title={descripcion}>
        {contenido}
      </div>
    );
  }

  return (
    <Link href={item.href} className={clase} style={posicion} title={descripcion} aria-label={descripcion}>
      {contenido}
    </Link>
  );
}
