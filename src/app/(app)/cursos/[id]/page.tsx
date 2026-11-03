import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerCursoDelUsuario, hayActualizacionesDeCursoImportado } from "@/server/services/curso";
import { formatearFechaLima, timeAHora, DIAS_SEMANA } from "@/lib/dates";
import {
  actualizarCursoAction,
  agregarHorarioAction,
  actualizarHorarioCursoAction,
  agregarEvaluacionAction,
  eliminarEvaluacionAction,
  marcarEvaluacionEntregadaAction,
  sincronizarCursoAction,
} from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { BotonConfirmacion } from "@/components/boton-confirmacion";
import { SelectorHorarioSemanal } from "@/components/selector-horario-semanal";
import { Toast } from "@/components/toast";
import { Modal } from "@/components/modal";
import { IconAgregar } from "@/components/icons";

function timeAValor(fecha: Date) {
  return `${String(fecha.getUTCHours()).padStart(2, "0")}:${String(fecha.getUTCMinutes()).padStart(2, "0")}`;
}

export default async function CursoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; nuevo?: string; nuevaEvaluacion?: string; toast?: string }>;
}) {
  const { id } = await params;
  const idCurso = Number(id);
  if (!Number.isInteger(idCurso)) notFound();

  const sesion = await requerirSesion();
  const { error, nuevo, nuevaEvaluacion, toast } = await searchParams;

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
      <Toast mensaje={toast} />
      <div>
        <Link href="/cursos" className="text-sm text-primary hover:underline">
          Cursos
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{curso.nombre}</h1>
      </div>

      {error && nuevaEvaluacion !== "1" ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {nuevo === "1" ? (
        <section className="rounded-md border border-primary/30 bg-primary-soft px-4 py-3 text-sm">
          <p className="font-medium">Curso creado correctamente.</p>
          <p className="mt-1 text-text-muted">
            Ahora agrega su horario semanal y, si corresponde, la primera evaluación. Así aparecerán en tu calendario.
          </p>
        </section>
      ) : null}

      {curso.importadoDeIdCurso && hayActualizaciones ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary-soft px-3 py-2 text-sm">
          <span>Hay actualizaciones en el horario o las evaluaciones del curso original.</span>
          <form action={sincronizarCursoAction.bind(null, idCurso)}>
            <SubmitButton className="text-xs font-medium text-primary hover:underline" pendingText="Actualizando...">
              Actualizar desde el original
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
            Código
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
        <div>
          <h2 className="text-sm font-medium">Horario semanal</h2>
          <p className="mt-1 text-xs text-text-muted">
            El horario se conserva durante el ciclo. Puedes editar sus sesiones, pero no eliminarlas ni agregar otras.
          </p>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {curso.horarios.map((horario) => (
            <li key={horario.idHorario} className="rounded-md border border-border text-sm">
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 hover:bg-bg [&::-webkit-details-marker]:hidden">
                  <span className="font-medium">
                    {DIAS_SEMANA.find((dia) => dia.valor === horario.diaSemana)?.nombre}{" "}
                    <span className="font-normal text-text-muted">
                      {timeAHora(horario.horaInicio)} - {timeAHora(horario.horaFin)}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-primary">Editar</span>
                </summary>
                <form
                  action={actualizarHorarioCursoAction.bind(null, idCurso, horario.idHorario)}
                  className="border-t border-border bg-bg/50 p-4"
                >
                  <SelectorHorarioSemanal
                    modo="unico"
                    incluirDomingo={false}
                    diasSeleccionados={[horario.diaSemana]}
                    horaInicio={timeAValor(horario.horaInicio)}
                    horaFin={timeAValor(horario.horaFin)}
                    tituloDias="Día de clase"
                  />
                  <SubmitButton className="mt-5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover">
                    Guardar horario
                  </SubmitButton>
                </form>
              </details>
            </li>
          ))}
          {curso.horarios.length === 0 ? (
            <li className="text-sm text-text-muted">Sin sesiones registradas.</li>
          ) : null}
        </ul>

        {curso.horarios.length === 0 ? (
          <form action={agregarHorarioConId} className="mt-4 rounded-md border border-border bg-bg/50 p-4">
            <p className="mb-4 text-xs text-text-muted">
              Este curso todavía no tiene horario. Configúralo una vez para comenzar.
            </p>
            <SelectorHorarioSemanal
              incluirDomingo={false}
              diasSeleccionados={[]}
              horaInicio="09:00"
              horaFin="11:00"
              tituloDias="Días de clase"
            />
            <button
              type="submit"
              className="mt-5 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-bg"
            >
              Configurar horario
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Evaluaciones</h2>
          <Link
            href={`/cursos/${idCurso}?nuevaEvaluacion=1`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium hover:bg-bg"
          >
            <IconAgregar className="size-3.5" aria-hidden />
            Agregar evaluación
          </Link>
        </div>
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
                  <BotonConfirmacion
                    mensaje={`¿Quitar la evaluación “${evaluacion.nombre}”?`}
                    className="text-xs text-danger hover:underline"
                  >
                    Quitar
                  </BotonConfirmacion>
                </form>
              </div>
            </li>
          ))}
          {curso.evaluaciones.length === 0 ? (
            <li className="text-sm text-text-muted">Sin evaluaciones registradas.</li>
          ) : null}
        </ul>

      </section>

      {nuevaEvaluacion === "1" ? (
        <Modal
          titulo="Agregar evaluación"
          descripcion={`Registra una evaluación para ${curso.nombre}.`}
          cerrarEn={`/cursos/${idCurso}`}
        >
          {error ? (
            <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <form action={agregarEvaluacionConId} className="grid gap-3 sm:grid-cols-2">
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
        </Modal>
      ) : null}
    </div>
  );
}
