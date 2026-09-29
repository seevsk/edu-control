import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { obtenerUsuarioActual } from "@/server/services/usuario";
import { listarTareasAsignadasAlUsuario } from "@/server/services/tarea";
import { formatearFechaLima } from "@/lib/dates";
import { ETIQUETA_ESTADO_TAREA, COLOR_ESTADO_TAREA } from "@/lib/estado-tarea";

export default async function InicioPage() {
  const sesion = await requerirSesion();
  const [usuario, tareas] = await Promise.all([
    obtenerUsuarioActual(sesion.idUsuario),
    listarTareasAsignadasAlUsuario(sesion.idUsuario),
  ]);

  return (
    <div className="animate-page-in mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Hola, {usuario.nombre}</h1>
        <p className="mt-1 text-sm text-text-muted">Esto es lo que tenes pendiente en tus grupos.</p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-text-muted">Mis tareas asignadas</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {tareas.map((tarea) => {
            const curso = tarea.grupo.evaluacion?.curso;
            return (
              <li
                key={tarea.idTarea}
                className="rounded-md border border-border bg-surface p-3 text-sm"
              >
                <Link
                  href={`/grupos/${tarea.idGrupo}/tareas`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tarea.titulo}</p>
                    <p className="truncate text-xs text-text-muted">
                      {tarea.grupo.nombre}
                      {curso ? ` · ${curso.nombre}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {tarea.fechaLimite ? (
                      <span className="text-xs text-text-muted">
                        {formatearFechaLima(tarea.fechaLimite)}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1.5 text-xs">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: COLOR_ESTADO_TAREA[tarea.estado] }}
                        aria-hidden
                      />
                      {ETIQUETA_ESTADO_TAREA[tarea.estado]}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
          {tareas.length === 0 ? (
            <p className="text-sm text-text-muted">
              No tenes tareas asignadas por ahora. Cuando te asignen una en un grupo, va a
              aparecer aqui.
            </p>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
