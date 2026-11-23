import { accionesDisponiblesTarea, type AccionConMotivo, type EstadoTarea } from "@/lib/estado-tarea";
import { nombreCorto } from "@/lib/nombres";
import { SubmitButton } from "@/components/submit-button";
import { CerrarDetalles } from "@/components/cerrar-detalles";
import { cambiarEstadoTareaAction, reasignarTareaAction, tomarTareaAction } from "../actions";
import type { DestinoTarea, FiltrosTarea } from "@/lib/validation/tarea";

const TEXTOS_MOTIVO: Record<AccionConMotivo, { confirmar: string; enviando: string }> = {
  devolver: { confirmar: "Devolver", enviando: "Devolviendo..." },
  descartar: { confirmar: "Descartar", enviando: "Descartando..." },
  reabrir: { confirmar: "Reabrir", enviando: "Reabriendo..." },
};

const BOTON_SECUNDARIO =
  "rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-text hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary max-md:h-11 max-md:px-4 max-md:text-sm";
/** Móvil: la acción principal ocupa todo el ancho, como en Claude Design ("Móvil · Tarea"). */
const PRINCIPAL_MOVIL =
  "max-md:h-12 max-md:w-full max-md:justify-center max-md:rounded-xl max-md:border-transparent max-md:bg-primary max-md:text-[15px] max-md:font-semibold max-md:text-primary-foreground";

export function AccionesTarea({
  idGrupo,
  tarea,
  idUsuario,
  rol,
  asignables,
  destino = "lista",
  filtros = {},
  titulo,
}: {
  /** Encabezado que solo se muestra si hay alguna accion disponible. */
  titulo?: string;
  idGrupo: number;
  tarea: { idTarea: number; estado: EstadoTarea; idAsignado: number | null };
  idUsuario: number;
  rol: "lider" | "miembro" | "observador";
  asignables: { idUsuario: number; usuario: { nombre: string; apellidos: string | null } }[];
  destino?: DestinoTarea;
  filtros?: FiltrosTarea;
}) {
  if (rol === "observador") return null;
  const acciones = accionesDisponiblesTarea({ ...tarea, idUsuario, rol })
    .filter((accion) => destino === "detalle" || !accion.gestion);
  // El líder revisa su propia tarea, así que a él no se le dice que espera.
  const esperaRevision = tarea.estado === "en_revision" && tarea.idAsignado === idUsuario && rol !== "lider";
  const puedeReasignar = tarea.estado === "pendiente" || (tarea.estado === "en_progreso" && rol === "lider");
  const puedeTomar = tarea.estado === "pendiente" && tarea.idAsignado === null;
  if (acciones.length === 0 && !esperaRevision && !puedeReasignar && !puedeTomar) return null;
  const contenido = (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {puedeTomar ? (
        <form action={tomarTareaAction.bind(null, idGrupo, tarea.idTarea, destino, filtros)} className="max-md:w-full">
          <SubmitButton
            pendingText="Tomando..."
            className={`rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary max-md:h-12 max-md:w-full max-md:text-[15px] max-md:font-semibold`}
          >
            Tomar tarea
          </SubmitButton>
        </form>
      ) : null}
      {acciones.map((accion) => {
        const accionCambio = cambiarEstadoTareaAction.bind(null, idGrupo, tarea.idTarea, accion.estado, destino, filtros);
        if (accion.motivo) {
          const textos = TEXTOS_MOTIVO[accion.motivo];
          const destructiva = accion.motivo === "descartar";
          return (
            <details key={accion.motivo} className="group w-full">
              <summary
                className={`w-fit cursor-pointer list-none group-open:hidden [&::-webkit-details-marker]:hidden ${
                  destructiva
                    ? "rounded-md px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 max-md:flex max-md:h-11 max-md:items-center max-md:text-sm"
                    : BOTON_SECUNDARIO
                }`}
              >
                {accion.etiqueta}
              </summary>
              <form action={accionCambio} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Motivo
                  <textarea
                    name="motivo"
                    required
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-2 text-sm font-normal text-text"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <SubmitButton
                    pendingText={textos.enviando}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                      destructiva ? "bg-danger text-white hover:bg-danger/90" : "bg-primary text-primary-foreground hover:bg-primary-hover"
                    }`}
                  >
                    {textos.confirmar}
                  </SubmitButton>
                  <CerrarDetalles className="rounded-md px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg hover:text-text" />
                </div>
              </form>
            </details>
          );
        }
        const principal = accion === acciones.find((candidata) => !candidata.motivo);
        return (
          <form key={`${accion.estado}-${accion.etiqueta}`} action={accionCambio} className={principal ? "max-md:w-full" : undefined}>
            <SubmitButton
              pendingText={accion.estado === "completada" ? "Completando..." : "Actualizando..."}
              className={`${
                accion.estado === "completada"
                  ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  : BOTON_SECUNDARIO
              } ${principal ? PRINCIPAL_MOVIL : ""}`}
            >
              {accion.etiqueta}
            </SubmitButton>
          </form>
        );
      })}
      {esperaRevision ? <p className="text-xs text-text-muted">Esperando revisión</p> : null}
      {puedeReasignar ? (
        <details className="ml-auto">
          <summary className="cursor-pointer list-none rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted hover:bg-bg hover:text-text max-md:flex max-md:h-11 max-md:items-center max-md:text-sm [&::-webkit-details-marker]:hidden">
            {tarea.idAsignado === null ? "Asignar a alguien" : "Cambiar responsable"}
          </summary>
          <form
            action={reasignarTareaAction.bind(null, idGrupo, tarea.idTarea, destino, filtros)}
            className="mt-2 flex flex-wrap items-end gap-2"
          >
            <label className="flex flex-col gap-1 text-xs">
              Responsable
              <select
                name="idAsignado"
                defaultValue={tarea.idAsignado ?? ""}
                className="max-w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm max-md:min-h-11"
              >
                <option value="">Sin asignar</option>
                {asignables.map((integrante) => (
                  <option key={integrante.idUsuario} value={integrante.idUsuario}>
                    {nombreCorto(integrante.usuario.nombre, integrante.usuario.apellidos)}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton className="text-sm text-primary hover:underline">Guardar</SubmitButton>
          </form>
        </details>
      ) : null}
    </div>
  );
  if (!titulo) return contenido;
  return (
    <div className="mt-5 border-t border-border pt-4">
      <h2 className="mb-2 text-sm font-semibold">{titulo}</h2>
      {contenido}
    </div>
  );
}
