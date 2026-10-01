import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { obtenerUsuarioActual } from "@/server/services/usuario";
import { listarTareasAsignadasAlUsuario } from "@/server/services/tarea";
import { yaImportoCurso } from "@/server/services/curso";
import { formatearFechaLima } from "@/lib/dates";
import { ETIQUETA_ESTADO_TAREA, COLOR_ESTADO_TAREA } from "@/lib/estado-tarea";
import { SubmitButton } from "@/components/submit-button";
import { importarCursoAction } from "./cursos/actions";

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error } = await searchParams;
  const [usuario, tareas] = await Promise.all([
    obtenerUsuarioActual(sesion.idUsuario),
    listarTareasAsignadasAlUsuario(sesion.idUsuario),
  ]);

  const tarjetas = await Promise.all(
    tareas.map(async (tarea) => {
      const curso = tarea.grupo.evaluacion?.curso ?? null;
      const puedeImportar =
        curso !== null &&
        curso.idUsuario !== sesion.idUsuario &&
        !(await yaImportoCurso(sesion.idUsuario, curso.idCurso));
      return { tarea, curso, puedeImportar };
    }),
  );

  return (
    <div className="animate-page-in mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Hola, {usuario.nombre}</h1>
        <p className="mt-1 text-sm text-text-muted">Esto es lo que tenes pendiente en tus grupos.</p>
      </div>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="text-sm font-medium text-text-muted">Mis tareas asignadas</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {tarjetas.map(({ tarea, curso, puedeImportar }) => (
            <div
              key={tarea.idTarea}
              className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-sm"
            >
              <Link
                href={`/grupos/${tarea.idGrupo}/tareas`}
                className="flex flex-col gap-2 hover:opacity-90"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{tarea.titulo}</p>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-text-muted">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: COLOR_ESTADO_TAREA[tarea.estado] }}
                      aria-hidden
                    />
                    {ETIQUETA_ESTADO_TAREA[tarea.estado]}
                  </span>
                </div>
                <p className="truncate text-xs text-text-muted">
                  {tarea.grupo.nombre}
                  {curso ? ` · ${curso.nombre}` : ""}
                </p>
                {tarea.fechaLimite ? (
                  <p className="text-xs text-text-muted">
                    Limite: {formatearFechaLima(tarea.fechaLimite)}
                  </p>
                ) : null}
              </Link>

              {puedeImportar ? (
                <form action={importarCursoAction.bind(null, tarea.idGrupo, "/")}>
                  <SubmitButton
                    className="text-xs text-primary hover:underline"
                    pendingText="Importando..."
                  >
                    Traer &quot;{curso!.nombre}&quot; a mis cursos
                  </SubmitButton>
                </form>
              ) : null}
            </div>
          ))}
          {tareas.length === 0 ? (
            <p className="text-sm text-text-muted sm:col-span-2">
              No tenes tareas asignadas por ahora. Cuando te asignen una en un grupo, va a
              aparecer aqui.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
