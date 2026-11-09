import { formatearDuracion, formatearFechaHoraLima, formatearFechaLima } from "@/lib/dates";
import { COLOR_ESTADO_TAREA, ETIQUETA_ESTADO_TAREA } from "@/lib/estado-tarea";
import { describirCambioTarea, leerValorEstadoHistorial, type EntradaHistorialTarea } from "@/lib/tarea-historial";
import {
  calcularTiemposTarea,
  evaluarEntrega,
  fechaLimiteOriginal,
  type TareaParaTiempos,
  type Tramo,
} from "@/lib/tiempos-tarea";

type Entrada = EntradaHistorialTarea & { idUsuario: number };

function ChipTramo({ tramo }: { tramo: Tramo }) {
  const pausado = tramo.estado === "en_revision";
  const sinAsignar = tramo.idAsignado === null && tramo.estado !== "en_revision";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-bg px-2 py-0.5 text-[11px] text-text-muted">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: COLOR_ESTADO_TAREA[tramo.estado] }} aria-hidden />
      {sinAsignar ? "Sin asignar" : ETIQUETA_ESTADO_TAREA[tramo.estado]} {formatearDuracion(tramo.ms)}
      {pausado ? <span className="font-medium">· pausado</span> : null}
      {tramo.enCurso ? <span className="font-medium">· en curso</span> : null}
    </span>
  );
}

function Resumen({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-bg/60 px-3 py-2">
      <dt className="text-[11px] text-text-muted">{etiqueta}</dt>
      <dd className={`mt-0.5 text-sm font-semibold ${destacado ? "text-primary" : ""}`}>{valor}</dd>
    </div>
  );
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

  function textoEntrada(entrada: Entrada): string {
    const base = describirCambioTarea(entrada, nombres);
    if (entrada === creada && asignacionInicial) {
      return `${base} y la asignó a ${nombres.get(asignacionInicial.idUsuario) ?? "un integrante"}`;
    }
    if (entrada.accion === "vista") {
      const vista = tiempos.vistas.find((v) => v.vistaEn?.getTime() === entrada.fecha.getTime() && v.idUsuario === entrada.idUsuario);
      if (vista?.vistaEn) return `${base} (${formatearDuracion(vista.vistaEn.getTime() - vista.asignadaEn.getTime())} después de asignada)`;
    }
    return base;
  }

  function colorEntrada(entrada: Entrada): string {
    if (entrada.accion === "estado") {
      return COLOR_ESTADO_TAREA[leerValorEstadoHistorial(entrada.valorNuevo).estado ?? ""] ?? "var(--color-border-strong)";
    }
    if (entrada.accion === "creada") return COLOR_ESTADO_TAREA.pendiente;
    return "var(--color-border-strong)";
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2">
        <Resumen etiqueta="En progreso" valor={formatearDuracion(tiempos.enProgresoMs)} destacado />
        <Resumen etiqueta="Pendiente" valor={formatearDuracion(tiempos.pendienteMs)} />
        <Resumen etiqueta="En revisión" valor={formatearDuracion(tiempos.enRevisionMs)} />
        <Resumen etiqueta="Total" valor={formatearDuracion(tiempos.totalMs)} />
        {tiempos.sinAsignarMs > 0 ? <Resumen etiqueta="Sin asignar" valor={formatearDuracion(tiempos.sinAsignarMs)} /> : null}
      </dl>

      {tiempos.devoluciones || tiempos.reaperturas || tiempos.reprogramaciones || entrega || reprogramada ? (
        <ul className="flex flex-col gap-1 text-xs text-text-muted">
          {entrega ? (
            <li className={entrega.aTiempo ? "" : "font-medium text-danger"}>
              {entrega.aTiempo
                ? `Entregada a tiempo el ${formatearFechaHoraLima(entrega.entregadaEn)}`
                : `Entregada con ${formatearDuracion(entrega.entregadaEn.getTime() - entrega.fechaLimite!.getTime())} de atraso`}
            </li>
          ) : null}
          {reprogramada ? <li>Fecha límite original: {formatearFechaLima(original)}</li> : null}
          {tiempos.devoluciones ? <li>{tiempos.devoluciones} {tiempos.devoluciones === 1 ? "devolución" : "devoluciones"}</li> : null}
          {tiempos.reaperturas ? <li>{tiempos.reaperturas} {tiempos.reaperturas === 1 ? "reapertura" : "reaperturas"}</li> : null}
          {tiempos.reprogramaciones ? <li>{tiempos.reprogramaciones} {tiempos.reprogramaciones === 1 ? "reprogramación" : "reprogramaciones"}</li> : null}
        </ul>
      ) : null}

      {personasConTrabajo.length > 1 ? (
        <div>
          <h3 className="text-xs font-semibold">En progreso por persona</h3>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-text-muted">
            {personasConTrabajo.map(([idUsuario, ms]) => (
              <li key={idUsuario} className="flex justify-between gap-2">
                <span>{nombres.get(Number(idUsuario)) ?? "Integrante no disponible"}</span>
                <span className="font-medium text-text">{formatearDuracion(ms)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="relative flex flex-col gap-3 border-l border-border pl-4">
        {ordenado.map((entrada) => {
          const tramo = tiempos.tramoCerradoPor[entrada.idHistorial];
          return (
            <li key={entrada.idHistorial} className="relative text-sm">
              <span
                className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-surface"
                style={{ backgroundColor: colorEntrada(entrada) }}
                aria-hidden
              />
              {tramo && tramo.ms > 0 ? <ChipTramo tramo={tramo} /> : null}
              <p className="mt-1 break-words">{textoEntrada(entrada)}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                {entrada.usuario.nombre} {entrada.usuario.apellidos ?? ""} ·{" "}
                <time dateTime={entrada.fecha.toISOString()}>{formatearFechaHoraLima(entrada.fecha)}</time>
              </p>
            </li>
          );
        })}
        {tiempos.tramoActual ? (
          <li className="relative text-sm">
            <span
              className="absolute -left-[21px] top-1.5 size-2.5 rounded-full motion-safe:animate-pulse border-2 border-surface"
              style={{ backgroundColor: COLOR_ESTADO_TAREA[tiempos.tramoActual.estado] }}
              aria-hidden
            />
            <ChipTramo tramo={tiempos.tramoActual} />
          </li>
        ) : null}
      </ol>
    </div>
  );
}
