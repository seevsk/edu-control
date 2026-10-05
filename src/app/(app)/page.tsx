import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { obtenerUsuarioActual } from "@/server/services/usuario";
import { listarTareasAsignadasAlUsuario } from "@/server/services/tarea";
import { listarEvaluacionesProximas, yaImportoCurso } from "@/server/services/curso";
import { ETIQUETA_ESTADO_TAREA, COLOR_ESTADO_TAREA } from "@/lib/estado-tarea";
import { SubmitButton } from "@/components/submit-button";
import { Toast } from "@/components/toast";
import { IconoCurso } from "@/components/icono-curso";
import { AvataresGrupo } from "@/components/avatares-grupo";
import { DatosTarjeta } from "@/components/datos-tarjeta";
import { ChipModalidad } from "@/components/chip-modalidad";
import { EncabezadoTarjeta } from "@/components/encabezado-tarjeta";
import { TaloneraFecha } from "@/components/talonera-fecha";
import { importarCursoAction } from "./cursos/actions";

const TARJETA = "flex flex-col gap-3 rounded-md border border-border bg-surface p-3.5 text-sm transition-colors duration-150";

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; toast?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error, toast } = await searchParams;
  const [usuario, evaluaciones, tareas] = await Promise.all([
    obtenerUsuarioActual(sesion.idUsuario),
    listarEvaluacionesProximas(sesion.idUsuario),
    listarTareasAsignadasAlUsuario(sesion.idUsuario),
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

  return (
    <div className="animate-page-in mx-auto flex max-w-3xl flex-col gap-8">
      <Toast mensaje={toast} />

      <div>
        <h1 className="text-xl font-semibold">Hola, {usuario.nombre}</h1>
        <p className="mt-1 text-sm text-text-muted">Esto es lo que tenes pendiente.</p>
      </div>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <section>
        <h2 className="text-sm font-medium text-text-muted">Mis evaluaciones</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {evaluaciones.map((evaluacion) => (
            <Link
              key={evaluacion.idEvaluacion}
              href={`/cursos/${evaluacion.idCurso}`}
              className={`${TARJETA} flex-row hover:border-border-strong`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <EncabezadoTarjeta
                  etiqueta="Nombre de la evaluación"
                  titulo={evaluacion.nombre}
                  icono={<IconoCurso nombre={evaluacion.curso.nombre} codigo={evaluacion.curso.codigo} />}
                />
                <div className="border-t border-border pt-2.5">
                  <DatosTarjeta
                    datos={[
                      { etiqueta: "Nombre del curso", valor: evaluacion.curso.nombre },
                      {
                        etiqueta: "Modalidad",
                        valor: evaluacion.curso.modalidad ? <ChipModalidad modalidad={evaluacion.curso.modalidad} /> : null,
                      },
                    ]}
                  />
                </div>
              </div>
              <TaloneraFecha fecha={evaluacion.fechaCierre} />
            </Link>
          ))}
          {evaluaciones.length === 0 ? (
            <p className="text-sm text-text-muted sm:col-span-2">
              No tenes evaluaciones proximas. En cuanto registres una en un curso, va a aparecer aqui.
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-muted">Mis tareas asignadas</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {tarjetasTareas.map(({ tarea, curso, puedeImportar }) => (
            <div key={tarea.idTarea} className={TARJETA}>
              <Link href={`/grupos/${tarea.idGrupo}/tareas`} className="flex flex-1 gap-3 hover:opacity-90">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                <EncabezadoTarjeta etiqueta="Asignación de tarea" titulo={tarea.titulo} />
                <div className="border-t border-border pt-2.5">
                <DatosTarjeta
                  datos={[
                    {
                      etiqueta: "Estado",
                      valor: (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: COLOR_ESTADO_TAREA[tarea.estado] }}
                            aria-hidden
                          />
                          {ETIQUETA_ESTADO_TAREA[tarea.estado]}
                        </span>
                      ),
                      titulo: ETIQUETA_ESTADO_TAREA[tarea.estado],
                    },
                    { etiqueta: "Nombre del grupo", valor: tarea.grupo.nombre },
                    { etiqueta: "Nombre del curso", valor: curso?.nombre },
                    { etiqueta: "Modalidad", valor: curso?.modalidad ? <ChipModalidad modalidad={curso.modalidad} /> : null },
                  ]}
                />
                </div>
                </div>
                <TaloneraFecha fecha={tarea.fechaLimite} />
              </Link>

              <div className="flex items-end justify-between gap-2 border-t border-border pt-2.5">
                {puedeImportar ? (
                  <form action={importarCursoAction.bind(null, tarea.idGrupo, "/")}>
                    <SubmitButton className="text-xs text-primary hover:underline" pendingText="Importando...">
                      Traer &quot;{curso!.nombre}&quot; a mis cursos
                    </SubmitButton>
                  </form>
                ) : (
                  <span />
                )}
                <AvataresGrupo personas={tarea.grupo.integrantes.map((i) => i.usuario)} />
              </div>
            </div>
          ))}
          {tareas.length === 0 ? (
            <p className="text-sm text-text-muted sm:col-span-2">
              No tenes tareas asignadas por ahora. Cuando te asignen una en un grupo, va a aparecer aqui.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
