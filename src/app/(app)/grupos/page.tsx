import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { listarMisGrupos } from "@/server/services/grupo";
import { listarEvaluacionesDelUsuario } from "@/server/services/curso";
import { crearGrupoAction } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { IconoCurso } from "@/components/icono-curso";
import { AvataresGrupo } from "@/components/avatares-grupo";
import { DatosTarjeta } from "@/components/datos-tarjeta";
import { ChipModalidad } from "@/components/chip-modalidad";
import { EncabezadoTarjeta } from "@/components/encabezado-tarjeta";
import { formatearFechaLima } from "@/lib/dates";
import { etiquetaRelativa } from "@/lib/calendario";
import { IconAgregar } from "@/components/icons";

export default async function GruposPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; nuevo?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error, nuevo } = await searchParams;
  const grupos = await listarMisGrupos(sesion.idUsuario);
  const evaluaciones = await listarEvaluacionesDelUsuario(sesion.idUsuario);

  return (
    <div className="animate-page-in mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Grupos</h1>
          <p className="mt-1 text-sm text-text-muted">Coordina tareas, integrantes y reuniones de tus trabajos.</p>
        </div>
        <Link
          href="/grupos?nuevo=1#crear-grupo"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <IconAgregar className="size-4" aria-hidden />
          Crear grupo
        </Link>
      </div>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {grupos.map((grupo) => {
          const activos = grupo.integrantes.filter((i) => i.estadoInvitacion === "aceptada");
          const curso = grupo.evaluacion?.curso ?? null;
          const finalizado = grupo.estado === "finalizado";
          return (
            <li key={grupo.idGrupo}>
              <Link
                href={`/grupos/${grupo.idGrupo}`}
                className="flex h-full flex-col gap-3 rounded-md border border-border bg-surface p-3.5 text-sm transition-colors duration-150 hover:border-border-strong"
              >
                <EncabezadoTarjeta
                  etiqueta="Grupo"
                  titulo={grupo.nombre}
                  icono={<IconoCurso nombre={curso?.nombre ?? grupo.nombre} codigo={curso?.codigo} />}
                />
                <div className="border-t border-border pt-2.5">
                <DatosTarjeta
                  datos={[
                    { etiqueta: "Curso", valor: curso?.nombre },
                    { etiqueta: "Modalidad", valor: curso?.modalidad ? <ChipModalidad modalidad={curso.modalidad} /> : null },
                    {
                      etiqueta: "Finaliza",
                      valor: grupo.fechaLimite ? etiquetaRelativa(grupo.fechaLimite) : null,
                      titulo: grupo.fechaLimite ? formatearFechaLima(grupo.fechaLimite) : undefined,
                    },
                    {
                      etiqueta: "Estado",
                      valor: (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`size-2 rounded-full ${finalizado ? "bg-estado-pendiente" : "bg-estado-completada"}`}
                            aria-hidden
                          />
                          {finalizado ? "Finalizado" : "Activo"}
                        </span>
                      ),
                      titulo: finalizado ? "Finalizado" : "Activo",
                    },
                  ]}
                />
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5 text-xs">
                  <span>
                    <span className="text-text-muted">Número de integrantes:</span>{" "}
                    <span className="font-medium tabular-nums">{activos.length}</span>
                  </span>
                  <AvataresGrupo personas={activos.map((i) => i.usuario)} />
                </div>
              </Link>
            </li>
          );
        })}
        {grupos.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-strong px-4 py-6 text-center sm:col-span-2">
            <p className="text-sm text-text-muted">Todavía no perteneces a ningún grupo.</p>
            <a href="#crear-grupo" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
              Crear tu primer grupo
            </a>
          </div>
        ) : null}
      </ul>

      <details
        id="crear-grupo"
        className="scroll-mt-4 rounded-md border border-border bg-surface p-4"
        open={grupos.length === 0 || nuevo === "1"}
      >
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
            Descripción (opcional)
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
              Usar la fecha límite de una evaluación (opcional)
              <select
                name="idEvaluacion"
                defaultValue=""
                className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
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
          <SubmitButton className="mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
            Crear grupo
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}
