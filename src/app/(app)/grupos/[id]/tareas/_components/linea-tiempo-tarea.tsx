import { formatearDuracion, formatearFechaHoraLima, formatearFechaLima } from "@/lib/dates";
import { COLOR_ESTADO_TAREA } from "@/lib/estado-tarea";
import { nombreCorto } from "@/lib/nombres";
import { describirCambioTarea, leerValorEstadoHistorial, type EntradaHistorialTarea } from "@/lib/tarea-historial";
import {
  calcularTiemposTarea,
  evaluarEntrega,
  fechaLimiteOriginal,
  type TareaParaTiempos,
  type Tramo,
} from "@/lib/tiempos-tarea";

type Entrada = EntradaHistorialTarea & { idUsuario: number };

const FRASE_TRAMO: Record<string, string> = {
  pendiente: "pendiente",
  en_progreso: "en progreso",
  en_revision: "en revisión",
};

/** "3 min pendiente", "6 min en progreso": el tramo que termina con este evento. */
function textoTramo(tramo: Tramo): string {
  const frase = tramo.idAsignado === null && tramo.estado !== "en_revision"
    ? "sin asignar"
    : FRASE_TRAMO[tramo.estado] ?? tramo.estado;
  return `${formatearDuracion(tramo.ms)} ${frase}`;
}

function plural(cantidad: number, singular: string, varios: string) {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`;
}

export function LineaTiempoTarea({
  tarea,
  historial,
  nombres,
  ahora = new Date(),
}: {
  tarea: TareaParaTiempos;
  historial: Entrada[];
  nombres: ReadonlyMap<number, string>;
  ahora?: Date;
}) {
  const tiempos = calcularTiemposTarea(tarea, historial, ahora);
  const ordenado = [...historial].sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.idHistorial - b.idHistorial);
  const creada = ordenado.find((entrada) => entrada.accion === "creada");
  const asignacionInicial = creada && tiempos.vistas[0]?.asignadaEn.getTime() === creada.fecha.getTime()
    ? tiempos.vistas[0]
    : null;
  const entrega = evaluarEntrega(tarea, historial);
  const original = fechaLimiteOriginal(tarea, historial);
  const reprogramada = original && tarea.fechaLimite && original.getTime() !== tarea.fechaLimite.getTime();
  const personasConTrabajo = Object.entries(tiempos.trabajoPorUsuario);

  const tarjetas = [
    { etiqueta: "En progreso", ms: tiempos.enProgresoMs, color: COLOR_ESTADO_TAREA.en_progreso },
    { etiqueta: "En revisión", ms: tiempos.enRevisionMs, color: COLOR_ESTADO_TAREA.en_revision },
    { etiqueta: "Pendiente", ms: tiempos.pendienteMs, color: COLOR_ESTADO_TAREA.pendiente },
    ...(tiempos.sinAsignarMs > 0
      ? [{ etiqueta: "Sin asignar", ms: tiempos.sinAsignarMs, color: "var(--color-border-strong)" }]
      : []),
  ];
  const detalles = [
    reprogramada ? `fecha original ${formatearFechaLima(original)}` : null,
    tiempos.devoluciones ? plural(tiempos.devoluciones, "devolución", "devoluciones") : null,
    tiempos.reaperturas ? plural(tiempos.reaperturas, "reapertura", "reaperturas") : null,
    tiempos.reprogramaciones ? plural(tiempos.reprogramaciones, "reprogramación", "reprogramaciones") : null,
  ].filter(Boolean);

  function textoEntrada(entrada: Entrada): string {
    const base = describirCambioTarea(entrada, nombres);
    if (entrada === creada && asignacionInicial) {
      return `${base} y la asignó a ${nombres.get(asignacionInicial.idUsuario) ?? "un integrante"}`;
    }
    if (entrada.accion === "vista") return "Vio la tarea";
    return base;
  }

  function colorEntrada(entrada: Entrada): string {
    if (entrada.accion === "estado") {
      return COLOR_ESTADO_TAREA[leerValorEstadoHistorial(entrada.valorNuevo).estado ?? ""] ?? "var(--color-border-strong)";
    }
    return "var(--color-border-strong)";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-border bg-bg/60 px-3 py-2.5">
          <div>
            <p className="text-xs text-text-muted">Total</p>
            <p className="text-xl font-semibold">{formatearDuracion(tiempos.totalMs)}</p>
          </div>
          {entrega ? (
            <p className={`text-xs font-medium ${entrega.aTiempo ? "text-estado-completada" : "text-danger"}`}>
              {entrega.aTiempo
                ? "Entregada a tiempo"
                : `Entregada con ${formatearDuracion(entrega.entregadaEn.getTime() - entrega.fechaLimite!.getTime())} de atraso`}
            </p>
          ) : null}
        </div>
        <dl className="grid grid-cols-3 gap-2">
          {tarjetas.map((tarjeta) => (
            <div key={tarjeta.etiqueta} className="rounded-md border border-border bg-bg/60 px-2.5 py-2">
              <dt className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tarjeta.color }} aria-hidden />
                <span className="truncate">{tarjeta.etiqueta}</span>
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">{formatearDuracion(tarjeta.ms)}</dd>
            </div>
          ))}
        </dl>
        {detalles.length ? <p className="text-xs text-text-muted">{detalles.join(" · ")}</p> : null}
      </div>

      {personasConTrabajo.length > 1 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-text-muted">
          {personasConTrabajo.map(([idUsuario, ms]) => (
            <li key={idUsuario} className="flex justify-between gap-2">
              <span>{nombres.get(Number(idUsuario)) ?? "Integrante no disponible"}</span>
              <span className="text-text">{formatearDuracion(ms)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <ol className="flex flex-col border-l border-border">
        {ordenado.map((entrada) => {
          const tramo = tiempos.tramoCerradoPor[entrada.idHistorial];
          return (
            <li key={entrada.idHistorial} className="relative pb-3 pl-4 text-sm last:pb-0">
              <span
                className="absolute -left-[5px] top-1.5 size-2.5 rounded-full border-2 border-surface"
                style={{ backgroundColor: colorEntrada(entrada) }}
                aria-hidden
              />
              <p className="break-words">{textoEntrada(entrada)}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                {nombreCorto(entrada.usuario.nombre, entrada.usuario.apellidos)} ·{" "}
                <time dateTime={entrada.fecha.toISOString()}>{formatearFechaHoraLima(entrada.fecha)}</time>
                {tramo && tramo.ms > 0 ? <> · {textoTramo(tramo)}</> : null}
              </p>
            </li>
          );
        })}
        {tiempos.tramoActual ? (
          <li className="relative pl-4 text-xs text-text-muted">
            <span
              className="absolute -left-[5px] top-1 size-2.5 rounded-full border-2 border-surface"
              style={{ backgroundColor: COLOR_ESTADO_TAREA[tiempos.tramoActual.estado] }}
              aria-hidden
            />
            {textoTramo(tiempos.tramoActual)} hasta ahora
          </li>
        ) : null}
      </ol>
    </div>
  );
}
