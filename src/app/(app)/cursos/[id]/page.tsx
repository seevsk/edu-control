import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerCursoDelUsuario, hayActualizacionesDeCursoImportado } from "@/server/services/curso";
import { formatearFechaLima, timeAHora, DIAS_SEMANA, DIAS_SEMANA_CURSO } from "@/lib/dates";
import {
  actualizarCursoAction,
  agregarHorarioAction,
  eliminarHorarioAction,
  agregarEvaluacionAction,
  eliminarEvaluacionAction,
  marcarEvaluacionEntregadaAction,
  sincronizarCursoAction,
} from "../actions";
import { SubmitButton } from "@/components/submit-button";

export default async function CursoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const idCurso = Number(id);
  if (!Number.isInteger(idCurso)) notFound();

  const sesion = await requerirSesion();
  const { error } = await searchParams;

  let curso;
  try {
    curso = await obtenerCursoDelUsuario(sesion.idUsuario, idCurso);
  } catch {
    notFound();
  }

  const actualizarConId = actualizarCursoAction.bind(null, idCurso);
  const agregarHorarioConId = agregarHorarioAction.bind(null, idCurso);
  const agregarEvaluacionConId = agregarEvaluacionAction.bind(null, idCurso);
  const hayActualizaciones = curso.importadoDeIdCurso
    ? await hayActualizacionesDeCursoImportado(idCurso)
    : false;

  return (
    <div className="animate-page-in mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <Link href="/cursos" className="text-sm text-primary hover:underline">
          Cursos
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{curso.nombre}</h1>
      </div>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {curso.importadoDeIdCurso && hayActualizaciones ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary-soft px-3 py-2 text-sm">
          <span>Hay actualizaciones en el horario o las evaluaciones del curso original.</span>
          <form action={sincronizarCursoAction.bind(null, idCurso)}>
            <SubmitButton className="text-xs font-medium text-primary hover:underline" pendingText="Actualizando...">
              Traer actualizaciones
            </SubmitButton>
          </form>
        </div>
      ) : null}

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-medium">Datos del curso</h2>
        <form action={actualizarConId} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Nombre
            <input
              name="nombre"
              required
              maxLength={120}
              defaultValue={curso.nombre}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Codigo
            <input
              name="codigo"
              maxLength={30}
              defaultValue={curso.codigo ?? ""}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Docente
            <input
              name="docente"
              maxLength={120}
              defaultValue={curso.docente ?? ""}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Modalidad
            <select
              name="modalidad"
              defaultValue={curso.modalidad ?? ""}
              className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
            >
              <option value="">Sin especificar</option>
              <option value="presencial">Presencial</option>
              <option value="remoto">Remoto</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="activo" defaultChecked={curso.activo} />
            Curso activo este ciclo
          </label>
          <SubmitButton className="mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover sm:col-span-2">
            Guardar cambios
          </SubmitButton>
        </form>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-medium">Horario semanal</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {curso.horarios.map((horario) => (
            <li
              key={horario.idHorario}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>
                {DIAS_SEMANA.find((d) => d.valor === horario.diaSemana)?.nombre}{" "}
                {timeAHora(horario.horaInicio)} - {timeAHora(horario.horaFin)}
              </span>
              <form action={eliminarHorarioAction.bind(null, idCurso, horario.idHorario)}>
                <button type="submit" className="text-xs text-danger hover:underline">
                  Quitar
                </button>
              </form>
            </li>
          ))}
          {curso.horarios.length === 0 ? (
            <li className="text-sm text-text-muted">Sin sesiones registradas.</li>
          ) : null}
        </ul>

        <form action={agregarHorarioConId} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Dia
            <select
              name="diaSemana"
              required
              className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
            >
              {DIAS_SEMANA_CURSO.map((dia) => (
                <option key={dia.valor} value={dia.valor}>
                  {dia.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Inicio
            <input
              type="time"
              name="horaInicio"
              required
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fin
            <input
              type="time"
              name="horaFin"
              required
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-bg"
          >
            Agregar sesion
          </button>
        </form>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-medium">Evaluaciones</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {curso.evaluaciones.map((evaluacion) => (
            <li
              key={evaluacion.idEvaluacion}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{evaluacion.nombre}</p>
                <p className="text-xs text-text-muted">
                  Cierra {formatearFechaLima(evaluacion.fechaCierre)}
                  {evaluacion.fechaEntrega ? " · entregada" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {evaluacion.requiereEntrega && !evaluacion.fechaEntrega ? (
                  <form
                    action={marcarEvaluacionEntregadaAction.bind(
                      null,
                      idCurso,
                      evaluacion.idEvaluacion,
                    )}
                  >
                    <button type="submit" className="text-xs text-primary hover:underline">
                      Marcar entregada
                    </button>
                  </form>
                ) : null}
                <form
                  action={eliminarEvaluacionAction.bind(null, idCurso, evaluacion.idEvaluacion)}
                >
                  <button type="submit" className="text-xs text-danger hover:underline">
                    Quitar
                  </button>
                </form>
              </div>
            </li>
          ))}
          {curso.evaluaciones.length === 0 ? (
            <li className="text-sm text-text-muted">Sin evaluaciones registradas.</li>
          ) : null}
        </ul>

        <form action={agregarEvaluacionConId} className="mt-4 grid gap-3 sm:grid-cols-2">
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
            Apertura (opcional)
            <input
              type="date"
              name="fechaApertura"
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Cierre
            <input
              type="date"
              name="fechaCierre"
              required
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requiereEntrega" defaultChecked />
            Requiere entrega presencial
          </label>
          <button
            type="submit"
            className="mt-1 w-fit rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-bg sm:col-span-2"
          >
            Agregar evaluacion
          </button>
        </form>
      </section>
    </div>
  );
}
