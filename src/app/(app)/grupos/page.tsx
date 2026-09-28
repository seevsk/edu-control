import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { listarMisGrupos } from "@/server/services/grupo";
import { listarEvaluacionesDelUsuario } from "@/server/services/curso";
import { crearGrupoAction } from "./actions";

export default async function GruposPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error } = await searchParams;
  const grupos = await listarMisGrupos(sesion.idUsuario);
  const evaluaciones = await listarEvaluacionesDelUsuario(sesion.idUsuario);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Grupos</h1>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {grupos.map((grupo) => {
          const activos = grupo.integrantes.filter((i) => i.estadoInvitacion === "aceptada");
          return (
            <li key={grupo.idGrupo}>
              <Link
                href={`/grupos/${grupo.idGrupo}`}
                className="flex items-center justify-between rounded-md border border-border bg-surface p-4 hover:border-border-strong"
              >
                <div>
                  <p className="text-sm font-medium">{grupo.nombre}</p>
                  <p className="text-xs text-text-muted">
                    {activos.length} integrante{activos.length === 1 ? "" : "s"}
                  </p>
                </div>
                {grupo.estado === "finalizado" ? (
                  <span className="rounded-sm bg-bg px-1.5 py-0.5 text-[11px] text-text-muted">
                    Finalizado
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
        {grupos.length === 0 ? (
          <p className="text-sm text-text-muted">Todavia no perteneces a ningun grupo.</p>
        ) : null}
      </ul>

      <details className="rounded-md border border-border bg-surface p-4" open={grupos.length === 0}>
        <summary className="cursor-pointer text-sm font-medium">Crear grupo</summary>
        <form action={crearGrupoAction} className="mt-4 grid gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Nombre
            <input
              name="nombre"
              required
              maxLength={120}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Descripcion (opcional)
            <textarea
              name="descripcion"
              maxLength={500}
              rows={2}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Enlace del trabajo (opcional)
            <input
              name="enlaceTrabajo"
              placeholder="https://..."
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          {evaluaciones.length > 0 ? (
            <label className="flex flex-col gap-1 text-sm">
              Precargar fecha limite desde una evaluacion (opcional)
              <select
                name="idEvaluacion"
                defaultValue=""
                className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
              >
                <option value="">Sin evaluacion</option>
                {evaluaciones.map((evaluacion) => (
                  <option key={evaluacion.idEvaluacion} value={evaluacion.idEvaluacion}>
                    {evaluacion.curso.nombre} · {evaluacion.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="submit"
            className="mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Crear grupo
          </button>
        </form>
      </details>
    </div>
  );
}
