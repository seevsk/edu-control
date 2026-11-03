import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { listarCursos, listarCursosImportables } from "@/server/services/curso";
import { formatearFechaLima, timeAHora } from "@/lib/dates";
import {
  DIAS_LARGOS,
  diaSemanaISO,
  etiquetaRelativa,
  fechaEnZonaLimaISO,
  minutosDelDiaLima,
} from "@/lib/calendario";
import { colorCurso } from "@/lib/color-curso";
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
import { ChipModalidad } from "@/components/chip-modalidad";
import { BotonConfirmacion } from "@/components/boton-confirmacion";
import { SelectorHorarioSemanal } from "@/components/selector-horario-semanal";
import { Modal } from "@/components/modal";
import {
  IconAgregar,
  IconBuscar,
  IconCalendario,
  IconCursos,
  IconReloj,
} from "@/components/icons";

/** La siguiente sesión desde ahora (en Lima): una clase de hoy que ya empezó pasa a la próxima semana. */
function proximaClase(horarios: { diaSemana: number; horaInicio: Date }[], ahora: Date) {
  if (horarios.length === 0) return null;
  const hoy = diaSemanaISO(fechaEnZonaLimaISO(ahora));
  const ahoraMin = minutosDelDiaLima(ahora);

  const candidatas = horarios.map((horario) => {
    const inicioMin = horario.horaInicio.getUTCHours() * 60 + horario.horaInicio.getUTCMinutes();
    let dias = (horario.diaSemana - hoy + 7) % 7;
    if (dias === 0 && inicioMin <= ahoraMin) dias = 7;
    return { horario, dias, orden: dias * 1440 + inicioMin };
  });
  const { horario, dias } = candidatas.sort((a, b) => a.orden - b.orden)[0];

  return {
    dia: dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : DIAS_LARGOS[horario.diaSemana - 1],
    hora: timeAHora(horario.horaInicio),
  };
}

export default async function CursosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; toast?: string; vista?: string; nuevo?: string; q?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error, toast, vista, nuevo, q } = await searchParams;
  const verInactivos = vista === "inactivos";
  const ahora = new Date();
  const [cursosActivos, cursosInactivos, importables] = await Promise.all([
    listarCursos(sesion.idUsuario, true),
    listarCursos(sesion.idUsuario, false),
    listarCursosImportables(sesion.idUsuario),
  ]);
  const consultaOriginal = q?.trim() ?? "";
  const consulta = consultaOriginal.toLocaleLowerCase("es-PE");
  const cursosDeVista = (verInactivos ? cursosInactivos : cursosActivos).filter((curso) => {
    if (!consulta) return true;
    return [curso.nombre, curso.codigo, curso.docente]
      .filter((texto): texto is string => Boolean(texto))
      .some((texto) => texto.toLocaleLowerCase("es-PE").includes(consulta));
  });
  const sesionesSemanales = cursosActivos.reduce((total, curso) => total + curso.horarios.length, 0);
  const evaluacionesProximas = cursosActivos.reduce(
    (total, curso) =>
      total + curso.evaluaciones.filter((evaluacion) => evaluacion.fechaCierre >= ahora).length,
    0,
  );

  return (
    <div className="animate-page-in mx-auto flex max-w-6xl flex-col gap-6">
      <Toast mensaje={toast} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Cursos</h1>
          <p className="mt-1 text-sm text-text-muted">
            Consulta de un vistazo tus clases, evaluaciones y configuración del ciclo.
          </p>
        </div>
        {!verInactivos ? (
          <Link
            href="/cursos?nuevo=1"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <IconAgregar className="size-4" aria-hidden />
            Agregar curso
          </Link>
        ) : null}
      </div>

      {error && nuevo !== "1" ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="grid grid-cols-3 gap-3" aria-label="Resumen de cursos">
        <div className="rounded-md border border-border bg-surface px-4 py-3">
          <p className="text-xs font-medium text-text-muted">Cursos activos</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{cursosActivos.length}</p>
        </div>
        <div className="rounded-md border border-border bg-surface px-4 py-3">
          <p className="text-xs font-medium text-text-muted">Sesiones por semana</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{sesionesSemanales}</p>
        </div>
        <div className="rounded-md border border-border bg-surface px-4 py-3">
          <p className="text-xs font-medium text-text-muted">Evaluaciones próximas</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{evaluacionesProximas}</p>
        </div>
      </section>

      {!verInactivos && importables.length > 0 ? (
        <section className="rounded-md border border-primary/30 bg-primary-soft p-4" aria-labelledby="cursos-importables">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="cursos-importables" className="text-sm font-medium">Cursos disponibles desde tus grupos</h2>
              <p className="mt-1 text-xs text-text-muted">
                Impórtalos para traer su información, horarios y evaluaciones sin registrarlos nuevamente.
              </p>
            </div>
            <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
              {importables.length}
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {importables.map(({ cursoFuente, idGrupo, idCursoLocal, hayActualizaciones }) => (
              <li
                key={cursoFuente.idCurso}
                className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <IconoCurso nombre={cursoFuente.nombre} codigo={cursoFuente.codigo} tamano="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{cursoFuente.nombre}</p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {[cursoFuente.codigo, cursoFuente.docente].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                    </p>
                  </div>
                </div>
                {idCursoLocal && hayActualizaciones ? (
                  <form action={sincronizarCursoAction.bind(null, idCursoLocal)}>
                    <SubmitButton
                      className="shrink-0 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium hover:bg-bg"
                      pendingText="Actualizando..."
                    >
                      Actualizar
                    </SubmitButton>
                  </form>
                ) : (
                  <form action={importarCursoAction.bind(null, idGrupo, "/cursos")}>
                    <SubmitButton
                      className="shrink-0 rounded-md border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft"
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

      <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
        <nav
          className="flex w-fit overflow-hidden rounded-md border border-border-strong text-sm"
          aria-label="Estado de los cursos"
        >
          <Link
            href={consulta ? `/cursos?q=${encodeURIComponent(consultaOriginal)}` : "/cursos"}
            aria-current={!verInactivos ? "page" : undefined}
            className={`px-3 py-1.5 ${!verInactivos ? "bg-primary-soft font-medium text-primary" : "hover:bg-bg"}`}
          >
            Activos <span className="ml-1 text-xs tabular-nums">{cursosActivos.length}</span>
          </Link>
          <Link
            href={
              consulta
                ? `/cursos?vista=inactivos&q=${encodeURIComponent(consultaOriginal)}`
                : "/cursos?vista=inactivos"
            }
            aria-current={verInactivos ? "page" : undefined}
            className={`border-l border-border-strong px-3 py-1.5 ${verInactivos ? "bg-primary-soft font-medium text-primary" : "hover:bg-bg"}`}
          >
            Inactivos <span className="ml-1 text-xs tabular-nums">{cursosInactivos.length}</span>
          </Link>
        </nav>

        <form action="/cursos" className="flex w-full max-w-md gap-2">
          {verInactivos ? <input type="hidden" name="vista" value="inactivos" /> : null}
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar cursos</span>
            <IconBuscar
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar por curso, código o docente"
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
              href={verInactivos ? "/cursos?vista=inactivos" : "/cursos"}
              className="self-center text-xs font-medium text-primary hover:underline"
            >
              Limpiar
            </Link>
          ) : null}
        </form>
      </div>

      <ul className="grid grid-cols-3 gap-4">
        {cursosDeVista.map((curso) => {
          const clase = proximaClase(curso.horarios, ahora);
          const proximaEvaluacion = curso.evaluaciones.find((evaluacion) => evaluacion.fechaCierre >= ahora) ?? null;
          const color = colorCurso(curso.codigo || curso.nombre);

          return (
            <li key={curso.idCurso}>
              <article className="group flex h-full min-h-80 flex-col overflow-hidden rounded-md border border-border bg-surface transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-sm">
                <div className="h-1" style={{ backgroundColor: color.bg }} aria-hidden />
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <IconoCurso nombre={curso.nombre} codigo={curso.codigo} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                        <span className={`size-1.5 rounded-full ${curso.activo ? "bg-estado-completada" : "bg-estado-pendiente"}`} aria-hidden />
                        <span>{curso.activo ? "Activo" : "Inactivo"}</span>
                        <span aria-hidden>·</span>
                        <span>{curso.importadoDeIdCurso ? "Importado" : "Propio"}</span>
                      </div>
                      <Link
                        href={`/cursos/${curso.idCurso}`}
                        className="mt-0.5 block truncate font-semibold leading-snug group-hover:text-primary"
                      >
                        {curso.nombre}
                      </Link>
                      <p className="mt-1 truncate text-xs text-text-muted">{curso.codigo || "Sin código"}</p>
                    </div>
                    <MenuAcciones etiqueta={`Más opciones de ${curso.nombre}`}>
                      <Link href={`/cursos/${curso.idCurso}`} className="px-3 py-1.5 text-left text-sm hover:bg-bg">
                        Editar
                      </Link>
                      <form action={alternarActivoCursoAction.bind(null, curso.idCurso)}>
                        <button type="submit" className="w-full px-3 py-1.5 text-left text-sm hover:bg-bg">
                          {curso.activo ? "Marcar inactivo" : "Marcar activo"}
                        </button>
                      </form>
                      <form action={eliminarCursoAction.bind(null, curso.idCurso)}>
                        <BotonConfirmacion
                          mensaje={`¿Eliminar el curso ${curso.nombre}? También se eliminarán sus horarios y evaluaciones.`}
                          className="w-full px-3 py-1.5 text-left text-sm text-danger hover:bg-danger/10"
                        >
                          Eliminar
                        </BotonConfirmacion>
                      </form>
                    </MenuAcciones>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-bg/60 p-3 text-xs">
                    <div>
                      <p className="text-text-muted">Docente</p>
                      <p className="mt-1 truncate font-medium" title={curso.docente ?? undefined}>
                        {curso.docente || "Sin registrar"}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-muted">Modalidad</p>
                      <div className="mt-1">
                        {curso.modalidad ? <ChipModalidad modalidad={curso.modalidad} /> : <span className="font-medium text-text-muted">Sin especificar</span>}
                      </div>
                    </div>
                  </div>

                  <div className="grid flex-1 grid-rows-2 divide-y divide-border rounded-md border border-border">
                    <div className="flex items-start gap-2.5 p-3">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-cat-clases-bg text-cat-clases-fg">
                        <IconReloj className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium">Próxima clase</p>
                        {clase ? (
                          <p className="mt-1 text-xs text-text-muted">
                            {clase.dia} · {clase.hora}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-text-muted">Sin horario registrado</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-3">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-cat-laboral-bg text-cat-laboral-fg">
                        <IconCalendario className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium">Próxima evaluación</p>
                        {proximaEvaluacion ? (
                          <>
                            <p className="mt-1 truncate text-xs text-text" title={proximaEvaluacion.nombre}>
                              {proximaEvaluacion.nombre}
                            </p>
                            <p className="mt-0.5 text-[11px] text-text-muted">
                              {etiquetaRelativa(proximaEvaluacion.fechaCierre, ahora)} · {formatearFechaLima(proximaEvaluacion.fechaCierre)}
                              {proximaEvaluacion.fechaEntrega ? " · Entregada" : ""}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 text-xs text-text-muted">Sin evaluaciones próximas</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-border bg-bg/40 px-4 py-2.5 text-xs">
                  <Link href={`/cursos/${curso.idCurso}`} className="font-medium text-primary hover:underline">
                    Gestionar curso
                  </Link>
                  <span className="text-text-muted">
                    {curso.horarios.length} {curso.horarios.length === 1 ? "sesión" : "sesiones"} · {curso.evaluaciones.length} {curso.evaluaciones.length === 1 ? "evaluación" : "evaluaciones"}
                  </span>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {cursosDeVista.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-strong bg-surface px-5 py-10 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <IconCursos className="size-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-medium">
            {consulta
              ? "No encontramos cursos con esa búsqueda"
              : verInactivos
                ? "No tienes cursos inactivos"
                : "Todavía no registraste ningún curso"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">
            {consulta
              ? "Prueba con el nombre, código o docente del curso."
              : verInactivos
                ? "Los cursos que termines durante el ciclo aparecerán en esta sección."
                : "Agrega el primero para configurar sus horarios y evaluaciones."}
          </p>
          {consulta ? (
            <Link
              href={verInactivos ? "/cursos?vista=inactivos" : "/cursos"}
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              Limpiar búsqueda
            </Link>
          ) : !verInactivos ? (
            <Link href="/cursos?nuevo=1" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Agregar tu primer curso
            </Link>
          ) : null}
        </div>
      ) : null}

      {!verInactivos && nuevo === "1" ? (
        <Modal
          titulo="Agregar curso"
          descripcion="Registra los datos y el horario semanal inicial del curso."
          cerrarEn="/cursos"
          tamano="xl"
        >
          {error ? (
            <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <form action={crearCursoAction} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <p className="text-sm font-medium">Datos del curso</p>
              <p className="mt-1 text-xs text-text-muted">
                Registra el horario inicial ahora; después podrás agregar más franjas y evaluaciones.
              </p>
            </div>
            <label className="col-span-2 flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Nombre</span>
              <input
                name="nombre"
                required
                maxLength={120}
                placeholder="Ej. Desarrollo de Aplicaciones Web"
                className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Código</span>
              <input
                name="codigo"
                required
                maxLength={30}
                placeholder="Ej. DAW-2026"
                className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Docente</span>
              <input
                name="docente"
                maxLength={120}
                placeholder="Nombre del docente"
                className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Modalidad</span>
              <select
                name="modalidad"
                defaultValue=""
                className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
              >
                <option value="">Sin especificar</option>
                <option value="presencial">Presencial</option>
                <option value="remoto">Remoto</option>
              </select>
            </label>
            <fieldset className="col-span-2 rounded-md border border-border bg-bg/60 p-4">
              <legend className="px-1 text-sm font-medium">Horario semanal inicial</legend>
              <SelectorHorarioSemanal
                incluirDomingo={false}
                diasSeleccionados={[]}
                horaInicio="09:00"
                horaFin="11:00"
                tituloDias="Días de clase"
              />
            </fieldset>
            <SubmitButton className="col-span-2 mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
              Guardar curso
            </SubmitButton>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
