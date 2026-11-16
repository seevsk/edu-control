import { CalendarClock, CalendarPlus, PackageCheck } from "lucide-react";
import { accionesEvaluacion, describirHistorialEvaluacion, ETIQUETA_ESTADO_EVALUACION, evaluacionAbierta, leerValorEvaluacion, type EstadoEvaluacion } from "@/lib/estado-evaluacion";
import { distancia, fechaCompleta, fechaCorta, marcaActividad } from "@/lib/formato-fecha";
import { StatusIcon } from "@/components/ui-app/status-icon";
import { SubmitButton } from "@/components/submit-button";
import { CerrarDetalles } from "@/components/cerrar-detalles";
import { cn } from "@/lib/utils";
import { cambiarEstadoEvaluacionAction, marcarEvaluacionEntregadaAction } from "../../actions";
import { RegistrarVistaEvaluacion } from "./registrar-vista-evaluacion";

const BOTON = "inline-flex h-8 items-center rounded-md border border-input px-3 text-[13px] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";
const BOTON_PRIMARIO = "inline-flex h-8 items-center rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";

export interface EvaluacionDetalle {
  idEvaluacion: number;
  nombre: string;
  estado: EstadoEvaluacion;
  fechaApertura: Date | null;
  fechaCierre: Date;
  requiereEntrega: boolean;
  fechaEntrega: Date | null;
  historial: { idHistorial: number; accion: "creada" | "vista" | "estado" | "entrega"; valorAnterior: string | null; valorNuevo: string | null; fecha: Date }[];
}

export function DetalleEvaluacion({ idCurso, evaluacion, error }: { idCurso: number; evaluacion: EvaluacionDetalle; error?: string }) {
  const ahora = new Date();
  const acciones = accionesEvaluacion(evaluacion);
  const abierta = evaluacionAbierta(evaluacion.estado);
  const vencida = abierta && evaluacion.fechaCierre < ahora;
  const cambiarEstado = cambiarEstadoEvaluacionAction.bind(null, idCurso, evaluacion.idEvaluacion);

  return (
    <div className="flex flex-col gap-6">
      <RegistrarVistaEvaluacion idEvaluacion={evaluacion.idEvaluacion} />
      {error ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-4 text-[13px]">
        <div>
          <p className="mb-1 text-xs text-subtle-foreground">Estado</p>
          <span className="inline-flex items-center gap-1.5">
            <StatusIcon estado={evaluacion.estado} />
            {ETIQUETA_ESTADO_EVALUACION[evaluacion.estado]}
          </span>
        </div>
        <div>
          <p className="mb-1 text-xs text-subtle-foreground">Cierra</p>
          <time dateTime={evaluacion.fechaCierre.toISOString()} title={fechaCompleta(evaluacion.fechaCierre)} className={cn(vencida && "text-destructive")}>
            {fechaCorta(evaluacion.fechaCierre, { ahora, conHora: true })}
            <span className="ml-1.5 text-subtle-foreground">{vencida ? "· venció" : `· ${distancia(evaluacion.fechaCierre, ahora)}`}</span>
          </time>
        </div>
        {evaluacion.fechaApertura ? (
          <div>
            <p className="mb-1 text-xs text-subtle-foreground">Abre</p>
            <time dateTime={evaluacion.fechaApertura.toISOString()}>{fechaCorta(evaluacion.fechaApertura, { ahora })}</time>
          </div>
        ) : null}
        <div>
          <p className="mb-1 text-xs text-subtle-foreground">Entrega</p>
          {!evaluacion.requiereEntrega ? (
            <span className="text-subtle-foreground">Sin entrega (examen o exposición)</span>
          ) : evaluacion.fechaEntrega ? (
            <span className="text-estado-completada">Entregada {marcaActividad(evaluacion.fechaEntrega, ahora)}</span>
          ) : (
            <span className="text-hoy">Por entregar</span>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-[13px] font-medium text-muted-foreground">Tu avance</h3>
        <div className="flex flex-wrap items-center gap-2">
          {evaluacion.requiereEntrega && evaluacion.estado !== "descartada" ? (
            <form action={marcarEvaluacionEntregadaAction.bind(null, idCurso, evaluacion.idEvaluacion, !evaluacion.fechaEntrega)}>
              <SubmitButton className={BOTON} pendingText="Guardando…" disabled={Boolean(evaluacion.fechaEntrega) && evaluacion.estado === "completada"}>
                <PackageCheck className="size-3.5" aria-hidden />
                {evaluacion.fechaEntrega ? "Quitar entrega" : "Marcar entregada"}
              </SubmitButton>
            </form>
          ) : null}
          {acciones.filter((accion) => !accion.conMotivo).map((accion) => (
            <form key={accion.destino} action={cambiarEstado}>
              <input type="hidden" name="destino" value={accion.destino} />
              <SubmitButton className={accion.destino === "completada" ? BOTON_PRIMARIO : BOTON} disabled={Boolean(accion.bloqueada)} pendingText="Guardando…">
                {accion.etiqueta}
              </SubmitButton>
            </form>
          ))}
          {acciones.filter((accion) => accion.conMotivo).map((accion) => (
            <details key={accion.destino} className="group w-full">
              <summary className="w-fit cursor-pointer list-none rounded-md px-3 py-1.5 text-[13px] font-medium text-destructive group-open:hidden hover:bg-destructive/10 [&::-webkit-details-marker]:hidden">
                {accion.etiqueta}
              </summary>
              <form action={cambiarEstado} className="flex flex-col gap-2 rounded-md border p-3">
                <input type="hidden" name="destino" value={accion.destino} />
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Motivo
                  <textarea name="motivo" required maxLength={500} rows={3} className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm font-normal" />
                </label>
                <div className="flex items-center gap-2">
                  <SubmitButton className="inline-flex h-8 items-center rounded-md bg-destructive px-3 text-[13px] font-medium text-white hover:bg-destructive/90" pendingText="Descartando…">
                    Descartar
                  </SubmitButton>
                  <CerrarDetalles className="rounded-md px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground" />
                </div>
              </form>
            </details>
          ))}
        </div>
        {acciones.find((accion) => accion.bloqueada) ? (
          <p className="text-xs text-subtle-foreground">{acciones.find((accion) => accion.bloqueada)?.bloqueada}.</p>
        ) : null}
      </section>

      <section>
        <h3 className="mb-3.5 text-[13px] font-medium text-muted-foreground">Historial</h3>
        <ol>
          {[...evaluacion.historial].reverse().map((entrada, indice, lista) => {
            const motivo = entrada.accion === "estado" ? leerValorEvaluacion(entrada.valorNuevo).motivo : null;
            const Icono = entrada.accion === "creada" ? CalendarPlus : entrada.accion === "entrega" ? PackageCheck : CalendarClock;
            const estado = entrada.accion === "estado" ? (leerValorEvaluacion(entrada.valorNuevo).estado as EstadoEvaluacion | null) : null;
            return (
              <li key={entrada.idHistorial} className="relative flex gap-3 pb-5">
                {indice < lista.length - 1 ? <span className="absolute top-[26px] bottom-0 left-[11px] w-px bg-border" aria-hidden /> : null}
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  {estado ? <StatusIcon estado={estado} className="size-3.5" /> : <Icono className="size-3.5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1 pt-0.5 text-sm">
                  {describirHistorialEvaluacion(entrada)}
                  <time dateTime={entrada.fecha.toISOString()} title={fechaCompleta(entrada.fecha)} className="ml-1.5 text-xs text-subtle-foreground">{marcaActividad(entrada.fecha, ahora)}</time>
                  {motivo ? <blockquote className="mt-2 rounded-lg border bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">“{motivo}”</blockquote> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
