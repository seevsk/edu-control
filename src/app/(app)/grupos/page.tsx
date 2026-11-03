import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { listarMisGrupos } from "@/server/services/grupo";
import { listarEvaluacionesDelUsuario } from "@/server/services/curso";
import { crearGrupoAction } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { IconoCurso } from "@/components/icono-curso";
import { AvataresGrupo } from "@/components/avatares-grupo";
import { ChipModalidad } from "@/components/chip-modalidad";
import { formatearFechaLima } from "@/lib/dates";
import { diasHasta, etiquetaRelativa } from "@/lib/calendario";
import { calcularAvanceGrupo } from "@/lib/metricas";
import { IconAgregar, IconBuscar, IconCalendario, IconGrupos } from "@/components/icons";
import { Modal } from "@/components/modal";

const ETIQUETAS_ROL = {
  lider: "Líder",
  miembro: "Miembro",
  observador: "Observador",
} as const;

function claseFechaLimite(fecha: Date | null, finalizado: boolean, ahora: Date) {
  if (!fecha || finalizado) return "text-text-muted";
  const dias = diasHasta(fecha, ahora);
  if (dias < 0) return "text-danger";
  if (dias <= 3) return "text-estado-revision";
  return "text-text";
}

export default async function GruposPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; nuevo?: string; vista?: string; q?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error, nuevo, vista, q } = await searchParams;
  const grupos = await listarMisGrupos(sesion.idUsuario);
  const evaluaciones = await listarEvaluacionesDelUsuario(sesion.idUsuario);
  const verFinalizados = vista === "finalizados";
  const consultaOriginal = q?.trim() ?? "";
  const consulta = consultaOriginal.toLocaleLowerCase("es-PE");
  const activos = grupos.filter((grupo) => grupo.estado === "activo");
  const finalizados = grupos.filter((grupo) => grupo.estado === "finalizado");
  const gruposDeVista = (verFinalizados ? finalizados : activos).filter((grupo) => {
    if (!consulta) return true;
    const curso = grupo.evaluacion?.curso;
    return [grupo.nombre, grupo.descripcion, curso?.nombre, curso?.codigo]
      .filter((texto): texto is string => Boolean(texto))
      .some((texto) => texto.toLocaleLowerCase("es-PE").includes(consulta));
  });
  const ahora = new Date();
  const tareasAbiertas = activos.reduce(
    (total, grupo) => total + grupo.tareas.filter((tarea) => tarea.estado !== "completada").length,
    0,
  );

  return (
    <div className="animate-page-in mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Grupos</h1>
          <p className="mt-1 text-sm text-text-muted">
            Sigue el avance de tus trabajos y entra directamente a lo que necesita atención.
          </p>
        </div>
        <Link
          href="/grupos?nuevo=1"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <IconAgregar className="size-4" aria-hidden />
          Crear grupo
        </Link>
      </div>

      {error && nuevo !== "1" ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Resumen de grupos">
        <div className="rounded-md border border-border bg-surface px-4 py-3">
          <p className="text-xs font-medium text-text-muted">Grupos activos</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{activos.length}</p>
        </div>
        <div className="rounded-md border border-border bg-surface px-4 py-3">
          <p className="text-xs font-medium text-text-muted">Tareas abiertas</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{tareasAbiertas}</p>
        </div>
        <div className="col-span-2 rounded-md border border-border bg-surface px-4 py-3 sm:col-span-1">
          <p className="text-xs font-medium text-text-muted">Grupos finalizados</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{finalizados.length}</p>
        </div>
      </section>

      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <nav
          className="flex w-fit overflow-hidden rounded-md border border-border-strong text-sm"
          aria-label="Estado de los grupos"
        >
          <Link
            href={consulta ? `/grupos?q=${encodeURIComponent(consultaOriginal)}` : "/grupos"}
            aria-current={!verFinalizados ? "page" : undefined}
            className={`px-3 py-1.5 ${!verFinalizados ? "bg-primary-soft font-medium text-primary" : "hover:bg-bg"}`}
          >
            Activos <span className="ml-1 text-xs tabular-nums">{activos.length}</span>
          </Link>
          <Link
            href={
              consulta
                ? `/grupos?vista=finalizados&q=${encodeURIComponent(consultaOriginal)}`
                : "/grupos?vista=finalizados"
            }
            aria-current={verFinalizados ? "page" : undefined}
            className={`border-l border-border-strong px-3 py-1.5 ${verFinalizados ? "bg-primary-soft font-medium text-primary" : "hover:bg-bg"}`}
          >
            Finalizados <span className="ml-1 text-xs tabular-nums">{finalizados.length}</span>
          </Link>
        </nav>

        <form action="/grupos" className="flex w-full gap-2 sm:max-w-md">
          {verFinalizados ? <input type="hidden" name="vista" value="finalizados" /> : null}
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar grupos</span>
            <IconBuscar
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar por grupo o curso"
              className="w-full rounded-md border border-border-strong bg-surface py-1.5 pl-8 pr-3 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-bg"
          >
            Buscar
          </button>
          {consulta ? (
            <Link
              href={verFinalizados ? "/grupos?vista=finalizados" : "/grupos"}
              className="self-center text-xs font-medium text-primary hover:underline"
            >
              Limpiar
            </Link>
          ) : null}
        </form>
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {gruposDeVista.map((grupo) => {
          const integrantes = grupo.integrantes.filter((integrante) => integrante.estadoInvitacion === "aceptada");
          const curso = grupo.evaluacion?.curso ?? null;
          const finalizado = grupo.estado === "finalizado";
          const integranteActual = integrantes.find((integrante) => integrante.idUsuario === sesion.idUsuario)!;
          const avance = calcularAvanceGrupo(grupo.tareas);
          const porcentaje = avance === null ? null : Math.round(avance * 100);
          const pendientes = grupo.tareas.filter((tarea) => tarea.estado === "pendiente").length;
          const enCurso = grupo.tareas.filter(
            (tarea) => tarea.estado === "en_progreso" || tarea.estado === "en_revision",
          ).length;
          const completadas = grupo.tareas.filter((tarea) => tarea.estado === "completada").length;

          return (
            <li key={grupo.idGrupo}>
              <article className="group flex h-full flex-col overflow-hidden rounded-md border border-border bg-surface transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-sm">
                <div className="h-1 bg-primary" aria-hidden />
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <IconoCurso nombre={curso?.nombre ?? grupo.nombre} codigo={curso?.codigo} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            finalizado ? "text-text-muted" : "text-estado-completada"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${finalizado ? "bg-estado-pendiente" : "bg-estado-completada"}`}
                            aria-hidden
                          />
                          {finalizado ? "Finalizado" : "Activo"}
                        </span>
                        <span className="text-text-muted" aria-hidden>·</span>
                        <span className="text-[11px] text-text-muted">{ETIQUETAS_ROL[integranteActual.rol]}</span>
                      </div>
                      <Link
                        href={`/grupos/${grupo.idGrupo}`}
                        className="mt-0.5 block truncate font-semibold leading-snug group-hover:text-primary"
                      >
                        {grupo.nombre}
                      </Link>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                        <span className="truncate">{curso?.nombre ?? "Sin curso relacionado"}</span>
                        {curso?.modalidad ? <ChipModalidad modalidad={curso.modalidad} /> : null}
                      </div>
                    </div>
                  </div>

                  {grupo.descripcion ? (
                    <p className="line-clamp-2 min-h-10 text-xs leading-5 text-text-muted">{grupo.descripcion}</p>
                  ) : (
                    <p className="min-h-10 text-xs italic leading-5 text-text-muted">Sin descripción registrada.</p>
                  )}

                  <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-bg/60 p-3 text-xs">
                    <div>
                      <p className="text-text-muted">Fecha límite</p>
                      {grupo.fechaLimite ? (
                        <p
                          className={`mt-1 flex items-center gap-1.5 font-medium ${claseFechaLimite(
                            grupo.fechaLimite,
                            finalizado,
                            ahora,
                          )}`}
                          title={formatearFechaLima(grupo.fechaLimite)}
                        >
                          <IconCalendario className="size-3.5 shrink-0" aria-hidden />
                          <span>
                            {etiquetaRelativa(grupo.fechaLimite, ahora)}
                            <span className="font-normal text-text-muted"> · {formatearFechaLima(grupo.fechaLimite)}</span>
                          </span>
                        </p>
                      ) : (
                        <p className="mt-1 font-medium text-text-muted">Sin fecha</p>
                      )}
                    </div>
                    <div>
                      <p className="text-text-muted">Integrantes</p>
                      <div className="mt-1 flex items-center gap-2">
                        <AvataresGrupo personas={integrantes.map((integrante) => integrante.usuario)} maximo={3} />
                        <span className="font-medium tabular-nums">{integrantes.length}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium">Avance del grupo</span>
                      <span className={porcentaje === null ? "text-text-muted" : "font-semibold tabular-nums"}>
                        {porcentaje === null ? "Sin tareas" : `${porcentaje}%`}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg"
                      role={porcentaje === null ? undefined : "progressbar"}
                      aria-label={porcentaje === null ? undefined : `Avance de ${grupo.nombre}`}
                      aria-valuemin={porcentaje === null ? undefined : 0}
                      aria-valuemax={porcentaje === null ? undefined : 100}
                      aria-valuenow={porcentaje ?? undefined}
                    >
                      {porcentaje !== null ? (
                        <div className="h-full rounded-full bg-estado-completada" style={{ width: `${porcentaje}%` }} />
                      ) : null}
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 text-text-muted">
                        <span className="size-1.5 rounded-full bg-estado-pendiente" aria-hidden />
                        {pendientes} por hacer
                      </span>
                      <span className="flex items-center gap-1.5 text-text-muted">
                        <span className="size-1.5 rounded-full bg-estado-progreso" aria-hidden />
                        {enCurso} en curso
                      </span>
                      <span className="flex items-center gap-1.5 text-text-muted">
                        <span className="size-1.5 rounded-full bg-estado-completada" aria-hidden />
                        {completadas} completas
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border bg-bg/40 px-4 py-2.5 text-xs">
                  <Link href={`/grupos/${grupo.idGrupo}`} className="font-medium text-primary hover:underline">
                    Abrir grupo
                  </Link>
                  <div className="flex items-center gap-3">
                    <Link href={`/grupos/${grupo.idGrupo}/tareas`} className="text-text-muted hover:text-primary">
                      Tareas
                    </Link>
                    {integranteActual.rol !== "observador" ? (
                      <Link href={`/grupos/${grupo.idGrupo}/horarios`} className="text-text-muted hover:text-primary">
                        Horarios
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {gruposDeVista.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-strong bg-surface px-5 py-10 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <IconGrupos className="size-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-medium">
            {consulta
              ? "No encontramos grupos con esa búsqueda"
              : verFinalizados
                ? "No tienes grupos finalizados"
                : "Todavía no perteneces a ningún grupo activo"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">
            {consulta
              ? "Prueba con el nombre del grupo, del curso o su código."
              : verFinalizados
                ? "Cuando finalices un grupo podrás consultarlo desde esta sección."
                : "Crea uno para organizar las tareas, horarios y reuniones de tu equipo."}
          </p>
          {consulta ? (
            <Link
              href={verFinalizados ? "/grupos?vista=finalizados" : "/grupos"}
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              Limpiar búsqueda
            </Link>
          ) : !verFinalizados ? (
            <Link href="/grupos?nuevo=1" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Crear tu primer grupo
            </Link>
          ) : null}
        </div>
      ) : null}

      {nuevo === "1" ? (
        <Modal
          titulo="Crear grupo"
          descripcion="Registra los datos del trabajo; después podrás invitar integrantes y distribuir las tareas."
          cerrarEn="/grupos"
        >
          {error ? (
            <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <form action={crearGrupoAction} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-sm font-medium">Datos del trabajo</p>
            <p className="mt-1 text-xs text-text-muted">Después podrás invitar integrantes y distribuir las tareas.</p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Nombre</span>
            <input
              name="nombre"
              required
              maxLength={120}
              placeholder="Ej. Proyecto final de Desarrollo Web"
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">
              Descripción <span className="font-normal text-text-muted">(opcional)</span>
            </span>
            <textarea
              name="descripcion"
              maxLength={500}
              rows={3}
              placeholder="Objetivo o alcance del trabajo"
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Enlace del trabajo <span className="font-normal text-text-muted">(opcional)</span>
            </span>
            <input
              name="enlaceTrabajo"
              placeholder="https://..."
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
            />
          </label>
          {evaluaciones.length > 0 ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Evaluación relacionada <span className="font-normal text-text-muted">(opcional)</span>
              </span>
              <select
                name="idEvaluacion"
                defaultValue=""
                className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
              >
                <option value="">Sin evaluación relacionada</option>
                {evaluaciones.map((evaluacion) => (
                  <option key={evaluacion.idEvaluacion} value={evaluacion.idEvaluacion}>
                    {evaluacion.curso.nombre} · {evaluacion.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <SubmitButton className="mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover sm:col-span-2">
            Crear grupo
          </SubmitButton>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
