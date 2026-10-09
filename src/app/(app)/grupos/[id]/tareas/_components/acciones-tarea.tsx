import { accionesDisponiblesTarea, type ESTADOS_TAREA_ORDEN } from "@/lib/estado-tarea";
import { SubmitButton } from "@/components/submit-button";
import { cambiarEstadoTareaAction, reasignarTareaAction } from "../actions";

export function AccionesTarea({
  idGrupo,
  tarea,
  idUsuario,
  rol,
  asignables,
  destino = "lista",
}: {
  idGrupo: number;
  tarea: { idTarea: number; estado: (typeof ESTADOS_TAREA_ORDEN)[number]; idAsignado: number | null };
  idUsuario: number;
  rol: "lider" | "miembro" | "observador";
  asignables: { idUsuario: number; usuario: { nombre: string; apellidos: string | null } }[];
  destino?: "lista" | "detalle";
}) {
  if (rol === "observador") return null;
  const acciones = accionesDisponiblesTarea({ ...tarea, idUsuario, rol });
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      {acciones.map((accion) => (
        <form key={accion.estado} action={cambiarEstadoTareaAction.bind(null, idGrupo, tarea.idTarea, accion.estado, destino)}>
          <SubmitButton className="text-sm text-primary hover:underline">{accion.etiqueta}</SubmitButton>
        </form>
      ))}
      <details className="ml-auto">
        <summary className="cursor-pointer text-sm text-text-muted hover:text-text">Reasignar</summary>
        <form
          action={reasignarTareaAction.bind(null, idGrupo, tarea.idTarea, destino)}
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
        </form>
      </details>
    </div>
  );
}
