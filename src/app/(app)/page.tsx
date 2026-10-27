import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { obtenerUsuarioActual } from "@/server/services/usuario";
import { listarTareasAsignadasAlUsuario } from "@/server/services/tarea";
import { listarCursos, listarEvaluacionesProximas, yaImportoCurso } from "@/server/services/curso";
import { listarInvitacionesPendientes, listarMisGrupos } from "@/server/services/grupo";
import { ETIQUETA_ESTADO_TAREA, COLOR_ESTADO_TAREA } from "@/lib/estado-tarea";
import { SubmitButton } from "@/components/submit-button";
import { Toast } from "@/components/toast";
import { IconoCurso } from "@/components/icono-curso";
import { AvataresGrupo } from "@/components/avatares-grupo";
import { DatosTarjeta } from "@/components/datos-tarjeta";
import { ChipModalidad } from "@/components/chip-modalidad";
import { EncabezadoTarjeta } from "@/components/encabezado-tarjeta";
import { formatearFechaLima } from "@/lib/dates";
import { etiquetaRelativa } from "@/lib/calendario";
import { importarCursoAction } from "./cursos/actions";

const TARJETA = "flex flex-col gap-3 rounded-md border border-border bg-surface p-4 text-sm transition-colors duration-150";

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; toast?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error, toast } = await searchParams;
  const [usuario, evaluaciones, tareas, cursos, grupos, invitaciones] = await Promise.all([
    obtenerUsuarioActual(sesion.idUsuario),
    listarEvaluacionesProximas(sesion.idUsuario),
    listarTareasAsignadasAlUsuario(sesion.idUsuario),
    listarCursos(sesion.idUsuario),
    listarMisGrupos(sesion.idUsuario),
    listarInvitacionesPendientes(sesion.idUsuario),
  ]);

  const tarjetasTareas = await Promise.all(
    tareas.map(async (tarea) => {
      const curso = tarea.grupo.evaluacion?.curso ?? null;
      const puedeImportar =
        curso !== null &&
        curso.idUsuario !== sesion.idUsuario &&
        !(await yaImportoCurso(sesion.idUsuario, curso.idCurso));
      return { tarea, curso, puedeImportar };
    }),
  );

  const tareasQueRequierenAccion = tarjetasTareas.filter(({ tarea }) => tarea.estado !== "en_revision");
  const tareasEnEspera = tarjetasTareas.filter(({ tarea }) => tarea.estado === "en_revision");
  const tieneCurso = cursos.length > 0;
  const tienePlanificacion = cursos.some((curso) => curso.horarios.length > 0 || curso.evaluaciones.length > 0);
  const tieneGrupo = grupos.length > 0;
  const mostrarPrimerosPasos = !tieneCurso || !tienePlanificacion || !tieneGrupo;
  const pasos = [
    {
      titulo: "Registra tu primer curso",
      detalle: "Añade el curso que quieres organizar durante este ciclo.",
      href: "/cursos?nuevo=1#agregar-curso",
      listo: tieneCurso,
    },
    {
      titulo: "Añade un horario o evaluación",
      detalle: "Esto alimenta tu calendario y tu disponibilidad semanal.",
      href: tieneCurso ? `/cursos/${cursos[0].idCurso}` : "/cursos?nuevo=1#agregar-curso",
      listo: tienePlanificacion,
    },
    {
      titulo: "Crea o acepta un grupo",
      detalle: "Después podrás invitar compañeros, repartir tareas y programar reuniones.",
      href: invitaciones.length > 0 ? "/invitaciones" : "/grupos?nuevo=1#crear-grupo",
      listo: tieneGrupo,
    },
  ];

  function TarjetaTarea({ item }: { item: (typeof tarjetasTareas)[number] }) {
    const { tarea, curso, puedeImportar } = item;
    return (
      <div className={TARJETA}>
        <Link href={`/grupos/${tarea.idGrupo}/tareas/${tarea.idTarea}`} className="flex flex-1 flex-col gap-3 hover:opacity-90">
          <EncabezadoTarjeta etiqueta="Tarea" titulo={tarea.titulo} />
          <div className="border-t border-border pt-2.5">
            <DatosTarjeta
              datos={[
                {
                  etiqueta: "Estado",
                  valor: (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_ESTADO_TAREA[tarea.estado] }} aria-hidden />
                      {ETIQUETA_ESTADO_TAREA[tarea.estado]}
                    </span>
                  ),
                  titulo: ETIQUETA_ESTADO_TAREA[tarea.estado],
                },
                { etiqueta: "Grupo", valor: tarea.grupo.nombre },
                { etiqueta: "Curso", valor: curso?.nombre },
                {
                  etiqueta: "Fecha límite",
                  valor: tarea.fechaLimite ? etiquetaRelativa(tarea.fechaLimite) : null,
                  titulo: tarea.fechaLimite ? formatearFechaLima(tarea.fechaLimite) : undefined,
                },
              ]}
            />
          </div>
        </Link>
        <div className="flex items-end justify-between gap-2 border-t border-border pt-2.5">
          {puedeImportar ? (
            <form action={importarCursoAction.bind(null, tarea.idGrupo, "/")}>
              <SubmitButton className="text-xs text-primary hover:underline" pendingText="Añadiendo...">
                Añadir &quot;{curso!.nombre}&quot; a mis cursos
              </SubmitButton>
            </form>
          ) : (
            <span />
          )}
          <AvataresGrupo personas={tarea.grupo.integrantes.map((integrante) => integrante.usuario)} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-in mx-auto flex max-w-5xl flex-col gap-7">
      <Toast mensaje={toast} />

      <div>
        <h1 className="text-xl font-semibold">Hola, {usuario.nombre}</h1>
        <p className="mt-1 text-sm text-text-muted">Revisa lo que requiere tu atención y lo que viene después.</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      {invitaciones.length > 0 ? (
        <Link
          href="/invitaciones"
          className="flex items-center justify-between gap-4 rounded-md border border-primary/30 bg-primary-soft px-4 py-3 text-sm hover:border-primary/50"
        >
          <span>
            <strong>Tienes {invitaciones.length} {invitaciones.length === 1 ? "invitación pendiente" : "invitaciones pendientes"}.</strong>{" "}
            Revísalas para unirte al grupo y comenzar a colaborar.
          </span>
          <span className="shrink-0 font-medium text-primary">Ver invitaciones →</span>
        </Link>
      ) : null}

      {mostrarPrimerosPasos ? (
        <section className="rounded-md border border-primary/30 bg-surface p-5" aria-labelledby="titulo-primeros-pasos">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Primeros pasos</p>
            <h2 id="titulo-primeros-pasos" className="mt-1 text-base font-semibold">Prepara EduControl para tu ciclo</h2>
            <p className="mt-1 text-sm text-text-muted">Completa estos pasos en orden; cada dato se reutiliza en el calendario y los grupos.</p>
          </div>
          <ol className="mt-4 grid gap-3 lg:grid-cols-3">
            {pasos.map((paso, indice) => (
              <li key={paso.titulo}>
                <Link
                  href={paso.href}
                  className={`flex h-full items-start gap-3 rounded-md border p-3 transition-colors ${
                    paso.listo ? "border-border bg-bg/60" : "border-border-strong hover:border-primary"
                  }`}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                      paso.listo ? "bg-estado-completada text-white" : "bg-primary-soft text-primary"
                    }`}
                    aria-hidden
                  >
                    {paso.listo ? "✓" : indice + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{paso.titulo}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">{paso.detalle}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Requiere tu atención</h2>
            <p className="mt-0.5 text-xs text-text-muted">Tareas que puedes continuar o enviar a revisión.</p>
          </div>
          {tareasQueRequierenAccion.length > 0 ? <Link href="/grupos" className="text-sm text-primary hover:underline">Ver grupos</Link> : null}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {tareasQueRequierenAccion.map((item) => <TarjetaTarea key={item.tarea.idTarea} item={item} />)}
          {tareasQueRequierenAccion.length === 0 ? (
            <div className="rounded-md border border-dashed border-border-strong px-4 py-5 text-sm text-text-muted lg:col-span-2">
              No tienes tareas que requieran una acción ahora mismo.
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-base font-semibold">Próximas evaluaciones</h2>
          <div className="mt-3 flex flex-col gap-3">
            {evaluaciones.slice(0, 4).map((evaluacion) => (
              <Link key={evaluacion.idEvaluacion} href={`/cursos/${evaluacion.idCurso}`} className={`${TARJETA} hover:border-border-strong`}>
                <EncabezadoTarjeta etiqueta="Evaluación" titulo={evaluacion.nombre} icono={<IconoCurso nombre={evaluacion.curso.nombre} codigo={evaluacion.curso.codigo} />} />
                <div className="border-t border-border pt-2.5">
                  <DatosTarjeta datos={[
                    { etiqueta: "Curso", valor: evaluacion.curso.nombre },
                    { etiqueta: "Modalidad", valor: evaluacion.curso.modalidad ? <ChipModalidad modalidad={evaluacion.curso.modalidad} /> : null },
                    { etiqueta: "Fecha límite", valor: etiquetaRelativa(evaluacion.fechaCierre), titulo: formatearFechaLima(evaluacion.fechaCierre) },
                  ]} />
                </div>
              </Link>
            ))}
            {evaluaciones.length === 0 ? (
              <div className="rounded-md border border-dashed border-border-strong px-4 py-5 text-sm text-text-muted">
                No tienes evaluaciones próximas.{" "}
                <Link href={tieneCurso ? `/cursos/${cursos[0].idCurso}` : "/cursos?nuevo=1#agregar-curso"} className="font-medium text-primary hover:underline">
                  {tieneCurso ? "Registrar una evaluación" : "Agregar un curso"}
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold">En espera</h2>
          <p className="mt-0.5 text-xs text-text-muted">Tareas terminadas que otro integrante debe revisar.</p>
          <div className="mt-3 flex flex-col gap-3">
            {tareasEnEspera.map((item) => <TarjetaTarea key={item.tarea.idTarea} item={item} />)}
            {tareasEnEspera.length === 0 ? (
              <div className="rounded-md border border-dashed border-border-strong px-4 py-5 text-sm text-text-muted">
                No tienes tareas esperando revisión.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
