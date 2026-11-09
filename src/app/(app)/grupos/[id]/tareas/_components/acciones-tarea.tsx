import { accionesDisponiblesTarea, type AccionConMotivo, type EstadoTarea } from "@/lib/estado-tarea";
import { nombreCorto } from "@/lib/nombres";
import { SubmitButton } from "@/components/submit-button";
import { CerrarDetalles } from "@/components/cerrar-detalles";
import { cambiarEstadoTareaAction, reasignarTareaAction } from "../actions";
import type { DestinoTarea, FiltrosTarea } from "@/lib/validation/tarea";

const TEXTOS_MOTIVO: Record<AccionConMotivo, { confirmar: string; enviando: string }> = {
  devolver: { confirmar: "Devolver", enviando: "Devolviendo..." },
  descartar: { confirmar: "Descartar", enviando: "Descartando..." },
  reabrir: { confirmar: "Reabrir", enviando: "Reabriendo..." },
};

const BOTON_SECUNDARIO =
  "rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-text hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

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
  const esperaRevision = tarea.estado === "en_revision" && tarea.idAsignado === idUsuario;
  const puedeReasignar = tarea.estado === "pendiente" || (tarea.estado === "en_progreso" && rol === "lider");
  if (acciones.length === 0 && !esperaRevision && !puedeReasignar) return null;
  const contenido = (
    <div className="flex flex-wrap items-center gap-2 pt-1">
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
                    ? "rounded-md px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
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
                    className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${
                      destructiva ? "bg-danger hover:bg-danger/90" : "bg-primary hover:bg-primary-hover"
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
        return (
          <form key={`${accion.estado}-${accion.etiqueta}`} action={accionCambio}>
            <SubmitButton
              pendingText={accion.estado === "completada" ? "Completando..." : "Actualizando..."}
              className={
                accion.estado === "completada"
                  ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  : BOTON_SECUNDARIO
              }
            >
              {accion.etiqueta}
            </SubmitButton>
          </form>
        );
      })}
      {esperaRevision ? <p className="text-xs text-text-muted">Esperando revisión</p> : null}
      {puedeReasignar ? (
        <details className="ml-auto">
          <summary className="cursor-pointer list-none rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted hover:bg-bg hover:text-text [&::-webkit-details-marker]:hidden">
            Cambiar responsable
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
                className="max-w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm"
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
