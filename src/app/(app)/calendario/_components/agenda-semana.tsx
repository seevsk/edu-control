import Link from "next/link";
import { DIAS_LARGOS, diaMesCorto } from "@/lib/calendario";
import { ESTILO_CATEGORIA, type Entrega, type ItemCalendario } from "./items";
import { ChipEntrega } from "./chip-entrega";

/** Vista movil: agenda por dia. En una pantalla angosta una grilla de 7 columnas no se lee. */
export function AgendaSemana({
  dias,
  hoyISO,
  items,
  entregas,
  textoDiaLibre,
}: {
  dias: string[];
  hoyISO: string;
  items: ItemCalendario[];
  entregas: Entrega[];
  textoDiaLibre: string;
}) {
  return (
    <ol className="flex flex-col gap-3 md:hidden">
      {dias.map((diaISO, i) => {
        const esHoy = diaISO === hoyISO;
        const delDia = items.filter((item) => item.diaSemana === i + 1).sort((a, b) => a.inicioMin - b.inicioMin);
        const entregasDelDia = entregas.filter((entrega) => entrega.diaISO === diaISO);

        return (
          <li
            key={diaISO}
            className={`overflow-hidden rounded-md border bg-surface ${esHoy ? "border-primary/40" : "border-border"}`}
            aria-current={esHoy ? "date" : undefined}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <p className="text-sm font-semibold">
                {DIAS_LARGOS[i]} <span className="font-normal text-text-muted">{diaMesCorto(diaISO)}</span>
              </p>
              {esHoy ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white">Hoy</span>
              ) : null}
            </div>

            {entregasDelDia.length > 0 ? (
              <div className="flex flex-col gap-1.5 border-b border-border bg-bg px-3 py-2">
                {entregasDelDia.map((entrega) => (
                  <ChipEntrega key={entrega.clave} entrega={entrega} />
                ))}
              </div>
            ) : null}

            {delDia.length === 0 ? (
              <p className="px-3 py-3 text-sm text-text-muted">{textoDiaLibre}</p>
            ) : (
              <ul className="divide-y divide-border">
                {delDia.map((item) => {
                  const { horaInicio: inicio, horaFin: fin } = item;
                  return (
                    <li key={item.clave}>
                      <Link href={item.href} className="flex gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-bg">
                        <span className="block w-[4.75rem] shrink-0 text-xs leading-5 tabular-nums">
                          <span className="block font-medium text-text">{inicio}</span>
                          <span className="block text-text-muted">{fin}</span>
                        </span>
                        <span
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${ESTILO_CATEGORIA[item.categoria].punto}`}
                          aria-hidden
                        />
                        <span className="block min-w-0">
                          <span className="block text-sm font-medium leading-5">{item.titulo}</span>
                          {item.subtitulo ? <span className="block text-xs text-text-muted">{item.subtitulo}</span> : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
