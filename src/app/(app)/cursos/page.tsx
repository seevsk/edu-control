import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { listarCursos, listarCursosImportables } from "@/server/services/curso";
import { formatearFechaLima, timeAHora, DIAS_SEMANA } from "@/lib/dates";
import { etiquetaRelativa } from "@/lib/calendario";
import {
  crearCursoAction,
  alternarActivoCursoAction,
  eliminarCursoAction,
  importarCursoAction,
  sincronizarCursoAction,
} from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { MenuAcciones } from "@/components/menu-acciones";
import { Toast } from "@/components/toast";
import { IconoCurso } from "@/components/icono-curso";
import { DatosTarjeta } from "@/components/datos-tarjeta";

function proximaClase(horarios: { diaSemana: number; horaInicio: Date }[]) {
  if (horarios.length === 0) return null;
  const [primero] = [...horarios].sort((a, b) => a.diaSemana - b.diaSemana);
  const dia = DIAS_SEMANA.find((d) => d.valor === primero.diaSemana)?.nombre;
  return `${dia} ${timeAHora(primero.horaInicio)}`;
}

export default async function CursosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; toast?: string; vista?: string; nuevo?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error, toast, vista, nuevo } = await searchParams;
  const verInactivos = vista === "inactivos";
  const cursos = await listarCursos(sesion.idUsuario, !verInactivos);
  const importables = verInactivos ? [] : await listarCursosImportables(sesion.idUsuario);

  return (
    <div className="animate-page-in mx-auto flex max-w-4xl flex-col gap-6">
      <Toast mensaje={toast} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Cursos</h1>
        <div className="flex overflow-hidden rounded-md border border-border-strong text-sm">
          <Link
            href="/cursos"
            className={`px-3 py-1.5 ${!verInactivos ? "bg-primary-soft text-primary" : "hover:bg-bg"}`}
          >
            Activos
          </Link>
          <Link
            href="/cursos?vista=inactivos"
            className={`px-3 py-1.5 ${verInactivos ? "bg-primary-soft text-primary" : "hover:bg-bg"}`}
          >
            Inactivos
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {importables.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary-soft p-4">
          <h2 className="text-sm font-medium">Disponibles de tus grupos</h2>
          <p className="text-xs text-text-muted">
            Estos cursos son de alguien que te invito a un grupo. Traelos para no escribirlos de
            nuevo a mano.
          </p>
          <ul className="flex flex-col gap-2">
            {importables.map(({ cursoFuente, idGrupo, idCursoLocal, hayActualizaciones }) => (
              <li
                key={cursoFuente.idCurso}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <IconoCurso nombre={cursoFuente.nombre} codigo={cursoFuente.codigo} tamano="sm" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate font-medium">{cursoFuente.nombre}</p>
                    <DatosTarjeta
                      datos={[
                        { etiqueta: "Código", valor: cursoFuente.codigo },
                        { etiqueta: "Docente", valor: cursoFuente.docente },
                      ]}
                    />
                  </div>
                </div>
                {idCursoLocal && hayActualizaciones ? (
                  <form action={sincronizarCursoAction.bind(null, idCursoLocal)}>
                    <SubmitButton
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                      pendingText="Actualizando..."
                    >
                      Traer actualizaciones
                    </SubmitButton>
                  </form>
                ) : (
                  <form action={importarCursoAction.bind(null, idGrupo, "/cursos")}>
                    <SubmitButton
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                      pendingText="Importando..."
                    >
                      Importar
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {cursos.map((curso) => {
          const clase = proximaClase(curso.horarios);
          const proximaEvaluacion = curso.evaluaciones.find((e) => e.fechaCierre >= new Date());

          return (
            <div
              key={curso.idCurso}
              className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
            >
              <div className="flex items-start gap-2">
                <Link
                  href={`/cursos/${curso.idCurso}`}
                  className="flex min-w-0 flex-1 items-start gap-3 hover:opacity-90"
                >
                  <IconoCurso nombre={curso.nombre} codigo={curso.codigo} />
                  <p className="min-w-0 pt-0.5 text-sm font-medium leading-snug">{curso.nombre}</p>
                </Link>

                <div className="flex shrink-0 items-center gap-1">
                  {curso.modalidad ? (
                    <span className="rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-text-muted">
                      {curso.modalidad}
                    </span>
                  ) : null}
                  <MenuAcciones etiqueta={`Mas opciones de ${curso.nombre}`}>
                    <Link href={`/cursos/${curso.idCurso}`} className="px-3 py-1.5 text-left text-sm hover:bg-bg">
                      Editar
                    </Link>
                    <form action={alternarActivoCursoAction.bind(null, curso.idCurso)}>
                      <button type="submit" className="w-full px-3 py-1.5 text-left text-sm hover:bg-bg">
                        {curso.activo ? "Marcar inactivo" : "Marcar activo"}
                      </button>
                    </form>
                    <form action={eliminarCursoAction.bind(null, curso.idCurso)}>
                      <button type="submit" className="w-full px-3 py-1.5 text-left text-sm text-danger hover:bg-danger/10">
                        Eliminar
                      </button>
                    </form>
                  </MenuAcciones>
                </div>
              </div>

              <DatosTarjeta
                datos={[
                  { etiqueta: "Código", valor: curso.codigo },
                  { etiqueta: "Docente", valor: curso.docente },
                ]}
              />

              <div className="border-t border-border pt-2.5">
                <DatosTarjeta
                  datos={[
                    { etiqueta: "Próxima clase", valor: clase ?? "Sin horario" },
                    { etiqueta: "Evaluación", valor: proximaEvaluacion?.nombre ?? "Sin evaluaciones próximas" },
                    {
                      etiqueta: "Finaliza",
                      valor: proximaEvaluacion ? etiquetaRelativa(proximaEvaluacion.fechaCierre) : null,
                      titulo: proximaEvaluacion ? formatearFechaLima(proximaEvaluacion.fechaCierre) : undefined,
                    },
                  ]}
                />
              </div>
            </div>
          );
        })}
      </div>

      {cursos.length === 0 ? (
        <p className="text-sm text-text-muted">
          {verInactivos
            ? "No tenes cursos inactivos."
            : "Todavia no registraste ningun curso. Agrega el primero abajo."}
        </p>
      ) : null}

      {!verInactivos ? (
        <details
          id="agregar-curso"
          className="scroll-mt-4 rounded-md border border-border bg-surface p-4"
          open={cursos.length === 0 || nuevo === "1"}
        >
          <summary className="cursor-pointer text-sm font-medium">Agregar curso</summary>
          <form action={crearCursoAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Nombre
              <input
                name="nombre"
                required
                maxLength={120}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Codigo
              <input
                name="codigo"
                maxLength={30}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Docente
              <input
                name="docente"
                maxLength={120}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Modalidad
              <select
                name="modalidad"
                defaultValue=""
                className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
              >
                <option value="">Sin especificar</option>
                <option value="presencial">Presencial</option>
                <option value="remoto">Remoto</option>
              </select>
            </label>
            <SubmitButton className="mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover sm:col-span-2">
              Guardar curso
            </SubmitButton>
          </form>
        </details>
      ) : null}
    </div>
  );
}
