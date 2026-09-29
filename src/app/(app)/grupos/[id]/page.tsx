import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario, buscarUsuarios } from "@/server/services/grupo";
import { formatearFechaLima } from "@/lib/dates";
import {
  actualizarGrupoAction,
  invitarIntegranteAction,
  retirarIntegranteAction,
} from "../actions";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { TabsGrupo } from "./_components/tabs-grupo";
import { obtenerMetricasGrupo } from "@/server/services/metricas";
import { yaImportoCurso } from "@/server/services/curso";
import { importarCursoAction } from "../../cursos/actions";

const ETIQUETAS_INVITACION: Record<string, string> = {
  pendiente: "Invitacion pendiente",
  aceptada: "Activo",
  rechazada: "Rechazo la invitacion",
  retirado: "Retirado",
};

export default async function GrupoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; q?: string }>;
}) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  const { error, q } = await searchParams;

  let grupo, rolActual;
  try {
    ({ grupo, rolActual } = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo));
  } catch {
    notFound();
  }

  const esLider = rolActual === "lider";
  const resultadosBusqueda = q ? await buscarUsuarios(sesion.idUsuario, q) : [];
  const idsYaEnGrupo = new Set(grupo.integrantes.map((i) => i.idUsuario));
  const { avance, porIntegrante } = await obtenerMetricasGrupo(sesion.idUsuario, idGrupo);

  const curso = grupo.evaluacion?.curso ?? null;
  const puedeImportarCurso =
    curso !== null &&
    curso.idUsuario !== sesion.idUsuario &&
    !(await yaImportoCurso(sesion.idUsuario, curso.idCurso));

  const actualizarConId = actualizarGrupoAction.bind(null, idGrupo);
  const invitarConId = invitarIntegranteAction.bind(null, idGrupo);

  return (
    <div className="animate-page-in mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <Link href="/grupos" className="text-sm text-primary hover:underline">
          Grupos
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{grupo.nombre}</h1>
        {grupo.descripcion ? (
          <p className="mt-1 text-sm text-text-muted">{grupo.descripcion}</p>
        ) : null}
      </div>

      <TabsGrupo idGrupo={idGrupo} activa="resumen" />

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {grupo.fechaLimite ? (
        <p className="text-sm">
          Fecha limite: <span className="font-medium">{formatearFechaLima(grupo.fechaLimite)}</span>
        </p>
      ) : null}
      {grupo.enlaceTrabajo ? (
        <a
          href={grupo.enlaceTrabajo}
          target="_blank"
          rel="noreferrer noopener"
          className="w-fit text-sm text-primary hover:underline"
        >
          Ver el trabajo
        </a>
      ) : null}

      {curso ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-muted">Curso: {curso.nombre}</span>
          {puedeImportarCurso ? (
            <form action={importarCursoAction.bind(null, idGrupo, `/grupos/${idGrupo}`)}>
              <SubmitButton className="text-xs text-primary hover:underline" pendingText="Importando...">
                Traer a mis cursos
              </SubmitButton>
            </form>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-medium">Avance del grupo</h2>
        {avance === null ? (
          <p className="mt-2 text-sm text-text-muted">Sin tareas todavia.</p>
        ) : (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
              <div
                className="h-full rounded-full bg-estado-completada"
                style={{ width: `${Math.round(avance * 100)}%` }}
              />
            </div>
            <span className="text-sm font-medium">{Math.round(avance * 100)}%</span>
          </div>
        )}

        {porIntegrante.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-text-muted">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Integrante</th>
                  <th className="py-1.5 pr-3 font-medium">Carga</th>
                  <th className="py-1.5 pr-3 font-medium">Cumplimiento</th>
                  <th className="py-1.5 font-medium">Puntualidad</th>
                </tr>
              </thead>
              <tbody>
                {porIntegrante.map((m) => (
                  <tr key={m.idUsuario} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-3">
                      <span className="flex items-center gap-2">
                        <Avatar nombre={m.nombre} apellidos={m.apellidos} fotoUrl={m.fotoUrl} tamano="sm" />
                        {m.nombre}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3">{Math.round(m.carga * 100)}%</td>
                    <td className="py-1.5 pr-3">
                      {m.cumplimiento === null ? (
                        <span className="text-text-muted">Sin tareas asignadas</span>
                      ) : (
                        `${Math.round(m.cumplimiento * 100)}%`
                      )}
                    </td>
                    <td className="py-1.5">
                      {m.puntualidad === null ? (
                        <span className="text-text-muted">-</span>
                      ) : (
                        `${Math.round(m.puntualidad * 100)}%`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-medium">Integrantes</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {grupo.integrantes.map((integrante) => (
            <li
              key={integrante.idIntegrante}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2.5">
                <Avatar
                  nombre={integrante.usuario.nombre}
                  apellidos={integrante.usuario.apellidos}
                  fotoUrl={integrante.usuario.fotoUrl}
                  tamano="sm"
                />
                <div>
                  <p className="font-medium">
                    {integrante.usuario.nombre} {integrante.usuario.apellidos ?? ""}
                    {integrante.rol === "lider" ? (
                      <span className="ml-2 text-xs text-text-muted">Lider</span>
                    ) : integrante.rol === "observador" ? (
                      <span className="ml-2 text-xs text-text-muted">Observador</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-text-muted">
                    {ETIQUETAS_INVITACION[integrante.estadoInvitacion]}
                  </p>
                </div>
              </div>
              {esLider &&
              integrante.rol !== "lider" &&
              integrante.estadoInvitacion !== "retirado" ? (
                <form action={retirarIntegranteAction.bind(null, idGrupo, integrante.idUsuario)}>
                  <button type="submit" className="text-xs text-danger hover:underline">
                    Retirar
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {esLider ? (
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-sm font-medium">Invitar a alguien</h2>
          <form action={`/grupos/${idGrupo}`} className="mt-3 flex gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Nombre o correo exacto"
              className="flex-1 rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-bg"
            >
              Buscar
            </button>
          </form>

          {q ? (
            <ul className="mt-3 flex flex-col gap-2">
              {resultadosBusqueda.map((persona) => (
                <li
                  key={persona.idUsuario}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2.5">
                    <Avatar
                      nombre={persona.nombre}
                      apellidos={persona.apellidos}
                      fotoUrl={persona.fotoUrl}
                      tamano="sm"
                    />
                    {persona.nombre} {persona.apellidos ?? ""}
                    <span className="text-xs text-text-muted">{persona.correo}</span>
                  </span>
                  {idsYaEnGrupo.has(persona.idUsuario) ? (
                    <span className="text-xs text-text-muted">Ya invitado</span>
                  ) : (
                    <form action={invitarConId}>
                      <input type="hidden" name="idUsuario" value={persona.idUsuario} />
                      <button type="submit" className="text-xs text-primary hover:underline">
                        Invitar
                      </button>
                    </form>
                  )}
                </li>
              ))}
              {resultadosBusqueda.length === 0 ? (
                <li className="text-sm text-text-muted">Sin resultados.</li>
              ) : null}
            </ul>
          ) : null}
        </section>
      ) : null}

      {esLider ? (
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-sm font-medium">Editar grupo</h2>
          <form action={actualizarConId} className="mt-3 grid gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Nombre
              <input
                name="nombre"
                required
                maxLength={120}
                defaultValue={grupo.nombre}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Descripcion
              <textarea
                name="descripcion"
                maxLength={500}
                rows={2}
                defaultValue={grupo.descripcion ?? ""}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Enlace del trabajo
              <input
                name="enlaceTrabajo"
                defaultValue={grupo.enlaceTrabajo ?? ""}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Estado
              <select
                name="estado"
                defaultValue={grupo.estado}
                className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
              >
                <option value="activo">Activo</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </label>
            <SubmitButton className="mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
              Guardar cambios
            </SubmitButton>
          </form>
        </section>
      ) : null}
    </div>
  );
}
