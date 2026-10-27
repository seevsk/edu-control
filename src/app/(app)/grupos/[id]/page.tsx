import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { obtenerMetricasGrupo } from "@/server/services/metricas";
import { yaImportoCurso } from "@/server/services/curso";
import { formatearFechaLima } from "@/lib/dates";
import { importarCursoAction } from "../../cursos/actions";
import { actualizarPreferenciaCorreoActividadAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { Toast } from "@/components/toast";
import { IconAgregar, IconReuniones } from "@/components/icons";
import { TabsGrupo } from "./_components/tabs-grupo";

export default async function GrupoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; nuevo?: string; toast?: string }>;
}) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  const { error, nuevo, toast } = await searchParams;
  const resultado = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!resultado) notFound();

  const { grupo, rolActual } = resultado;
  const integranteActual = grupo.integrantes.find((integrante) => integrante.idUsuario === sesion.idUsuario)!;
  const esLider = rolActual === "lider";
  const puedeParticipar = rolActual !== "observador" && grupo.estado === "activo";
  const { avance, porIntegrante } = await obtenerMetricasGrupo(sesion.idUsuario, idGrupo);

  const curso = grupo.evaluacion?.curso ?? null;
  const puedeImportarCurso =
    curso !== null &&
    curso.idUsuario !== sesion.idUsuario &&
    !(await yaImportoCurso(sesion.idUsuario, curso.idCurso));

  return (
    <div className="animate-page-in mx-auto flex max-w-5xl flex-col gap-6">
      <Toast mensaje={toast} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/grupos" className="text-sm text-primary hover:underline">
            Grupos
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-xl font-semibold">{grupo.nombre}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                grupo.estado === "activo"
                  ? "bg-estado-completada/15 text-estado-completada"
                  : "bg-bg text-text-muted"
              }`}
            >
              {grupo.estado === "activo" ? "Activo" : "Finalizado"}
            </span>
          </div>
          {grupo.descripcion ? <p className="mt-1 text-sm text-text-muted">{grupo.descripcion}</p> : null}
        </div>

        {puedeParticipar ? (
          <div className="flex flex-wrap items-center gap-2">
            {esLider ? (
              <Link
                href={`/grupos/${idGrupo}/integrantes#invitar`}
                className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-bg"
              >
                Invitar integrante
              </Link>
            ) : null}
            <Link
              href={`/reuniones/nueva?grupo=${idGrupo}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-bg"
            >
              <IconReuniones className="size-4" aria-hidden />
              Programar reunión
            </Link>
            <Link
              href={`/grupos/${idGrupo}/tareas?nueva=1#nueva-tarea`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <IconAgregar className="size-4" aria-hidden />
              Nueva tarea
            </Link>
          </div>
        ) : null}
      </div>

      <TabsGrupo idGrupo={idGrupo} activa="resumen" mostrarConfiguracion={esLider} />

      {nuevo === "1" ? (
        <section className="rounded-md border border-primary/30 bg-primary-soft px-4 py-3 text-sm">
          <p className="font-medium">Tu grupo ya está listo.</p>
          <p className="mt-1 text-text-muted">
            El siguiente paso es invitar a tus compañeros y crear las tareas del trabajo.
          </p>
        </section>
      ) : null}

      {grupo.estado === "finalizado" ? (
        <p role="status" className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          Este grupo está finalizado y es de solo lectura. Puedes consultar sus tareas, integrantes e historial.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3" aria-label="Datos principales del grupo">
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-muted">Fecha límite</p>
          <p className="mt-1 text-sm font-medium">
            {grupo.fechaLimite ? formatearFechaLima(grupo.fechaLimite) : "Sin fecha definida"}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-muted">Curso relacionado</p>
          <p className="mt-1 text-sm font-medium">{curso?.nombre ?? "Sin curso relacionado"}</p>
          {puedeImportarCurso ? (
            <form action={importarCursoAction.bind(null, idGrupo, `/grupos/${idGrupo}`)} className="mt-2">
              <SubmitButton className="text-xs font-medium text-primary hover:underline" pendingText="Añadiendo...">
                Añadir a mis cursos
              </SubmitButton>
            </form>
          ) : null}
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-muted">Documento del grupo</p>
          {grupo.enlaceTrabajo ? (
            <a
              href={grupo.enlaceTrabajo}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-block text-sm font-medium text-primary hover:underline"
            >
              Abrir documento ↗
            </a>
          ) : (
            <p className="mt-1 text-sm text-text-muted">Sin enlace registrado</p>
          )}
        </div>
      </section>

      {rolActual !== "observador" ? (
        <section id="notificaciones" aria-labelledby="titulo-notificaciones" className="scroll-mt-4 rounded-md border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h2 id="titulo-notificaciones" className="text-sm font-medium">Tus notificaciones de este grupo</h2>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                La campana dentro de EduControl siempre permanece activa. Esta preferencia solo controla los correos de actividad,
                como cuando una tarea pasa a revisión. Las invitaciones, asignaciones y devoluciones importantes siguen llegando.
              </p>
            </div>

            {grupo.estado === "activo" ? (
              <form action={actualizarPreferenciaCorreoActividadAction.bind(null, idGrupo)} className="flex flex-col items-start gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="correoActividad"
                    defaultChecked={integranteActual.correoActividad}
                    className="size-4 accent-primary"
                  />
                  Recibir correos de actividad
                </label>
                <SubmitButton
                  pendingText="Guardando..."
                  className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-bg"
                >
                  Guardar preferencia
                </SubmitButton>
              </form>
            ) : (
              <p className="text-xs text-text-muted">
                Preferencia {integranteActual.correoActividad ? "activada" : "desactivada"}. El grupo finalizado es de solo lectura.
              </p>
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Avance del grupo</h2>
            <p className="mt-0.5 text-xs text-text-muted">Basado en el peso de las tareas completadas.</p>
          </div>
          <details className="text-xs text-text-muted">
            <summary className="cursor-pointer text-primary hover:underline">Cómo se calcula</summary>
            <div className="mt-2 max-w-md space-y-1 rounded-md border border-border bg-bg p-3 leading-relaxed">
              <p><strong className="text-text">Carga:</strong> proporción del peso total asignado a cada integrante.</p>
              <p><strong className="text-text">Cumplimiento:</strong> peso completado frente al peso que recibió.</p>
              <p><strong className="text-text">Puntualidad:</strong> tareas enviadas a revisión antes de su fecha límite.</p>
            </div>
          </details>
        </div>

        {avance === null ? (
          <div className="mt-4 rounded-md border border-dashed border-border-strong px-4 py-5 text-center">
            <p className="text-sm text-text-muted">Aún no hay tareas para calcular el avance.</p>
            {puedeParticipar ? (
              <Link href={`/grupos/${idGrupo}/tareas?nueva=1#nueva-tarea`} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                Crear la primera tarea
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
              <div className="h-full rounded-full bg-estado-completada" style={{ width: `${Math.round(avance * 100)}%` }} />
            </div>
            <span className="text-sm font-medium">{Math.round(avance * 100)}%</span>
          </div>
        )}

        {porIntegrante.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Integrante</th>
                  <th className="py-2 pr-3 font-medium">Carga</th>
                  <th className="py-2 pr-3 font-medium">Cumplimiento</th>
                  <th className="py-2 font-medium">Puntualidad</th>
                </tr>
              </thead>
              <tbody>
                {porIntegrante.map((metrica) => (
                  <tr key={metrica.idUsuario} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 font-medium">{metrica.nombre}</td>
                    <td className="py-2 pr-3">{Math.round(metrica.carga * 100)}%</td>
                    <td className="py-2 pr-3">
                      {metrica.cumplimiento === null ? (
                        <span className="text-text-muted">Sin tareas asignadas</span>
                      ) : (
                        `${Math.round(metrica.cumplimiento * 100)}%`
                      )}
                    </td>
                    <td className="py-2">
                      {metrica.puntualidad === null ? (
                        <span className="text-text-muted">Sin datos</span>
                      ) : (
                        `${Math.round(metrica.puntualidad * 100)}%`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
