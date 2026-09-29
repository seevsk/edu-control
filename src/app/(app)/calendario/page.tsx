import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { obtenerSemanaCalendario } from "@/server/services/calendario";
import {
  lunesDeSemanaISO,
  sumarDiasISO,
  segmentosDelBloque,
  posicionEnGrid,
  fechaEnZonaLimaISO,
  HORA_INICIO_GRID,
  HORA_FIN_GRID,
} from "@/lib/calendario";
import { formatearFechaLima } from "@/lib/dates";

const NOMBRES_DIA = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

const COLOR_BLOQUE: Record<string, string> = {
  laboral: "var(--color-estado-revision)",
  familiar: "var(--color-estado-completada)",
  personal: "var(--color-text-muted)",
};

const ALTURA_GRID_PX = (HORA_FIN_GRID - HORA_INICIO_GRID) * 40;

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const sesion = await requerirSesion();
  const { semana } = await searchParams;

  const lunesISO = lunesDeSemanaISO(semana ? new Date(`${semana}T12:00:00-05:00`) : new Date());
  const { dias, horarios, bloquesOcupados, evaluaciones, tareas } = await obtenerSemanaCalendario(
    sesion.idUsuario,
    lunesISO,
  );

  const semanaAnterior = sumarDiasISO(lunesISO, -7);
  const semanaSiguiente = sumarDiasISO(lunesISO, 7);

  const segmentosPorDia = new Map<
    number,
    { topPct: number; heightPct: number; color: string; etiqueta: string }[]
  >();

  for (const horario of horarios) {
    for (const segmento of segmentosDelBloque(horario.diaSemana, horario.horaInicio, horario.horaFin)) {
      const posicion = posicionEnGrid(segmento.inicioMin, segmento.finMin);
      if (!posicion) continue;
      const lista = segmentosPorDia.get(segmento.diaSemana) ?? [];
      lista.push({ ...posicion, color: "var(--color-primary)", etiqueta: horario.etiqueta });
      segmentosPorDia.set(segmento.diaSemana, lista);
    }
  }

  for (const bloque of bloquesOcupados) {
    for (const segmento of segmentosDelBloque(bloque.diaSemana, bloque.horaInicio, bloque.horaFin)) {
      const posicion = posicionEnGrid(segmento.inicioMin, segmento.finMin);
      if (!posicion) continue;
      const lista = segmentosPorDia.get(segmento.diaSemana) ?? [];
      lista.push({ ...posicion, color: COLOR_BLOQUE[bloque.tipo], etiqueta: "Ocupado" });
      segmentosPorDia.set(segmento.diaSemana, lista);
    }
  }

  return (
    <div className="animate-page-in mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Calendario</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/calendario?semana=${semanaAnterior}`} className="text-primary hover:underline">
            Semana anterior
          </Link>
          <span className="text-text-muted">
            {formatearFechaLima(new Date(`${lunesISO}T12:00:00-05:00`))} -{" "}
            {formatearFechaLima(new Date(`${sumarDiasISO(lunesISO, 6)}T12:00:00-05:00`))}
          </span>
          <Link href={`/calendario?semana=${semanaSiguiente}`} className="text-primary hover:underline">
            Semana siguiente
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-7">
        {dias.map((diaISO, indice) => {
          const diaSemana = indice + 1;
          const segmentos = segmentosPorDia.get(diaSemana) ?? [];
          const eventosDelDia = [
            ...evaluaciones
              .filter((e) => fechaEnZonaLimaISO(e.fechaCierre) === diaISO)
              .map((e) => ({ tipo: "Evaluacion", nombre: `${e.curso.nombre}: ${e.nombre}` })),
            ...tareas
              .filter((t) => t.fechaLimite && fechaEnZonaLimaISO(t.fechaLimite) === diaISO)
              .map((t) => ({ tipo: "Tarea", nombre: `${t.grupo.nombre}: ${t.titulo}` })),
          ];

          return (
            <div key={diaISO} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-2">
              <p className="text-sm font-medium">
                {NOMBRES_DIA[indice]} <span className="text-text-muted">{diaISO.slice(8, 10)}</span>
              </p>

              {eventosDelDia.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {eventosDelDia.map((evento, i) => (
                    <li
                      key={i}
                      className={`truncate rounded-sm px-1.5 py-0.5 text-[11px] ${
                        evento.tipo === "Evaluacion"
                          ? "bg-danger/10 text-danger"
                          : "bg-primary-soft text-primary"
                      }`}
                      title={evento.nombre}
                    >
                      {evento.nombre}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="relative overflow-hidden rounded-sm bg-bg" style={{ height: ALTURA_GRID_PX }}>
                {Array.from({ length: HORA_FIN_GRID - HORA_INICIO_GRID }, (_, h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/60 text-[9px] text-text-muted"
                    style={{ top: `${(h / (HORA_FIN_GRID - HORA_INICIO_GRID)) * 100}%` }}
                  >
                    {HORA_INICIO_GRID + h}h
                  </div>
                ))}
                {segmentos.map((segmento, i) => (
                  <div
                    key={i}
                    className="absolute inset-x-0.5 rounded-sm px-1 text-[10px] text-white"
                    style={{
                      top: `${segmento.topPct}%`,
                      height: `${segmento.heightPct}%`,
                      backgroundColor: segmento.color,
                    }}
                    title={segmento.etiqueta}
                  >
                    <span className="truncate">{segmento.etiqueta}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: "var(--color-primary)" }} />
          Clases
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: COLOR_BLOQUE.laboral }} />
          Laboral
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: COLOR_BLOQUE.familiar }} />
          Familiar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: COLOR_BLOQUE.personal }} />
          Personal
        </span>
      </div>
    </div>
  );
}
