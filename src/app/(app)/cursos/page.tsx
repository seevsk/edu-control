import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { listarCursos } from "@/server/services/curso";
import { colorCurso, inicialesCurso } from "@/lib/color-curso";
import { formatearFechaLima, timeAHora, DIAS_SEMANA } from "@/lib/dates";
import { crearCursoAction } from "./actions";

function proximaClase(horarios: { diaSemana: number; horaInicio: Date }[]) {
  if (horarios.length === 0) return null;
  const [primero] = [...horarios].sort((a, b) => a.diaSemana - b.diaSemana);
  const dia = DIAS_SEMANA.find((d) => d.valor === primero.diaSemana)?.nombre;
  return `${dia} ${timeAHora(primero.horaInicio)}`;
}

export default async function CursosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error } = await searchParams;
  const cursos = await listarCursos(sesion.idUsuario);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cursos</h1>
      </div>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {cursos.map((curso) => {
          const color = colorCurso(curso.codigo || curso.nombre);
          const clase = proximaClase(curso.horarios);
          const proximaEvaluacion = curso.evaluaciones.find((e) => e.fechaCierre >= new Date());

          return (
            <Link
              key={curso.idCurso}
              href={`/cursos/${curso.idCurso}`}
              className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 hover:border-border-strong"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
                  style={{ backgroundColor: color.bg, color: color.fg }}
                >
                  {inicialesCurso(curso.nombre)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{curso.nombre}</p>
                  <p className="truncate text-xs text-text-muted">
                    {[curso.codigo, curso.docente].filter(Boolean).join(" · ") || "Sin detalles"}
                  </p>
                </div>
                {curso.modalidad ? (
                  <span className="ml-auto shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-text-muted">
                    {curso.modalidad}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-1 text-xs text-text-muted">
                <p>{clase ? `Proxima clase: ${clase}` : "Sin horario registrado"}</p>
                <p>
                  {proximaEvaluacion
                    ? `${proximaEvaluacion.nombre}: cierra ${formatearFechaLima(proximaEvaluacion.fechaCierre)}`
                    : "Sin evaluaciones proximas"}
                </p>
              </div>

              {!curso.activo ? (
                <span className="w-fit rounded-sm bg-bg px-1.5 py-0.5 text-[11px] text-text-muted">
                  Inactivo
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {cursos.length === 0 ? (
        <p className="text-sm text-text-muted">
          Todavia no registraste ningun curso. Agrega el primero abajo.
        </p>
      ) : null}

      <details className="rounded-md border border-border bg-surface p-4" open={cursos.length === 0}>
        <summary className="cursor-pointer text-sm font-medium">Agregar curso</summary>
        <form action={crearCursoAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Nombre
            <input
              name="nombre"
              required
              maxLength={120}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Codigo
            <input
              name="codigo"
              maxLength={30}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Docente
            <input
              name="docente"
              maxLength={120}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Modalidad
            <select
              name="modalidad"
              defaultValue=""
              className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Sin especificar</option>
              <option value="presencial">Presencial</option>
              <option value="remoto">Remoto</option>
            </select>
          </label>
          <button
            type="submit"
            className="mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover sm:col-span-2"
          >
            Guardar curso
          </button>
        </form>
      </details>
    </div>
  );
}
