import { accionesDisponiblesTarea, type AccionConMotivo, type EstadoTarea } from "@/lib/estado-tarea";
import { SubmitButton } from "@/components/submit-button";
import { cambiarEstadoTareaAction, reasignarTareaAction } from "../actions";
import type { DestinoTarea, FiltrosTarea } from "@/lib/validation/tarea";

const TEXTOS_MOTIVO: Record<AccionConMotivo, { placeholder: string; confirmar: string; enviando: string }> = {
  devolver: {
    placeholder: "Explica qué debe corregirse antes de volver a revisión",
    confirmar: "Confirmar devolución",
    enviando: "Devolviendo...",
  },
  descartar: {
    placeholder: "Explica por qué ya no se hará esta tarea",
    confirmar: "Confirmar descarte",
    enviando: "Descartando...",
  },
  reabrir: {
    placeholder: "Explica qué falta o qué debe corregirse",
    confirmar: "Confirmar reapertura",
    enviando: "Reabriendo...",
  },
};

export function AccionesTarea({
  idGrupo,
  tarea,
  idUsuario,
  rol,
  asignables,
  destino = "lista",
  filtros = {},
}: {
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
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {acciones.map((accion) => {
        const accionCambio = cambiarEstadoTareaAction.bind(null, idGrupo, tarea.idTarea, accion.estado, destino, filtros);
        if (accion.motivo) {
          const textos = TEXTOS_MOTIVO[accion.motivo];
          const destructiva = accion.motivo === "descartar";
          return (
            <details
              key={accion.motivo}
              className={`w-full rounded-md border p-2 ${destructiva ? "border-danger/30 bg-danger/5" : "border-estado-revision/40 bg-cat-laboral-bg"}`}
            >
              <summary className={`cursor-pointer text-xs font-medium ${destructiva ? "text-danger" : "text-cat-laboral-fg"}`}>
                {accion.etiqueta}
              </summary>
              <form action={accionCambio} className="mt-2 flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-xs">
                  Motivo
                  <textarea
                    name="motivo"
                    required
                    maxLength={500}
                    rows={3}
                    placeholder={textos.placeholder}
                    className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-2 text-sm text-text"
                  />
                </label>
                <SubmitButton
                  pendingText={textos.enviando}
                  className={`w-fit rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-surface ${
                    destructiva ? "border-danger text-danger" : "border-estado-revision text-cat-laboral-fg"
                  }`}
                >
                  {textos.confirmar}
                </SubmitButton>
              </form>
            </details>
          );
        }
        return (
          <form key={`${accion.estado}-${accion.etiqueta}`} action={accionCambio}>
            <SubmitButton
              pendingText={accion.estado === "completada" ? "Completando..." : "Actualizando..."}
              className={`rounded-md px-3 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                accion.estado === "completada"
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "border border-border-strong text-primary hover:bg-primary-soft"
              }`}
            >
              {accion.etiqueta}
            </SubmitButton>
          </form>
        );
      })}
      {esperaRevision ? (
        <p className="w-full text-xs text-text-muted">Pendiente de aprobación por otro integrante.</p>
      ) : null}
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
                    {integrante.usuario.nombre} {integrante.usuario.apellidos ?? ""}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton className="text-sm text-primary hover:underline">Guardar</SubmitButton>
            {tarea.estado === "en_progreso" ? (
              <p className="w-full text-[11px] text-text-muted">La tarea volverá a Pendiente.</p>
            ) : null}
          </form>
        </details>
      ) : null}
    </div>
  );
}
