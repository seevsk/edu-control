import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { buscarUsuarios, obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { Avatar } from "@/components/avatar";
import { BotonConfirmacion } from "@/components/boton-confirmacion";
import { invitarIntegranteAction, retirarIntegranteAction } from "../../actions";
import { TabsGrupo } from "../_components/tabs-grupo";

const ETIQUETAS_INVITACION: Record<string, string> = {
  pendiente: "Invitación pendiente",
  aceptada: "Activo",
  rechazada: "Rechazó la invitación",
  retirado: "Retirado",
};

const ETIQUETAS_ROL: Record<string, string> = {
  lider: "Líder",
  miembro: "Miembro",
  observador: "Observador",
};

export default async function IntegrantesGrupoPage({
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
  const resultado = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!resultado) notFound();

  const { grupo, rolActual } = resultado;
  const esLider = rolActual === "lider";
  const puedeAdministrar = esLider && grupo.estado === "activo";
  const resultadosBusqueda = puedeAdministrar && q ? await buscarUsuarios(sesion.idUsuario, q) : [];
  const idsYaEnGrupo = new Set(grupo.integrantes.map((integrante) => integrante.idUsuario));
  const invitar = invitarIntegranteAction.bind(null, idGrupo);

  return (
    <div className="animate-page-in mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Link href="/grupos" className="text-sm text-primary hover:underline">Grupos</Link>
        <h1 className="mt-1 text-xl font-semibold">{grupo.nombre}</h1>
      </div>

      <TabsGrupo idGrupo={idGrupo} activa="integrantes" mostrarConfiguracion={esLider} />

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Integrantes del grupo</h2>
            <p className="mt-1 text-xs text-text-muted">
              Solo los integrantes activos participan en asignaciones, métricas y disponibilidad.
            </p>
          </div>
          <span className="rounded-full bg-bg px-2 py-1 text-xs text-text-muted">
            {grupo.integrantes.filter((integrante) => integrante.estadoInvitacion === "aceptada").length} activos
          </span>
        </div>

        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-md border border-border">
          {grupo.integrantes.map((integrante) => (
            <li key={integrante.idIntegrante} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <Avatar
                  nombre={integrante.usuario.nombre}
                  apellidos={integrante.usuario.apellidos}
                  fotoUrl={integrante.usuario.fotoUrl}
                />
                <div>
                  <p className="font-medium">
                    {integrante.idUsuario === sesion.idUsuario ? (
                      `${integrante.usuario.nombre} ${integrante.usuario.apellidos ?? ""}`
                    ) : (
                      <Link href={`/usuarios/${integrante.idUsuario}`} className="hover:text-primary hover:underline">
                        {integrante.usuario.nombre} {integrante.usuario.apellidos ?? ""}
                      </Link>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {ETIQUETAS_ROL[integrante.rol]} · {ETIQUETAS_INVITACION[integrante.estadoInvitacion]}
                  </p>
                </div>
              </div>

              {puedeAdministrar && integrante.rol !== "lider" && integrante.estadoInvitacion !== "retirado" ? (
                <form action={retirarIntegranteAction.bind(null, idGrupo, integrante.idUsuario)}>
                  <BotonConfirmacion
                    mensaje={`¿Retirar a ${integrante.usuario.nombre} del grupo? Sus tareas abiertas quedarán sin asignar.`}
                    className="rounded-md px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
                  >
                    Retirar
                  </BotonConfirmacion>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {puedeAdministrar ? (
        <section id="invitar" className="scroll-mt-4 rounded-md border border-border bg-surface p-4">
          <h2 className="text-sm font-medium">Invitar integrante</h2>
          <p className="mt-1 text-xs text-text-muted">
            Busca por nombre con al menos tres caracteres o escribe el correo exacto de una persona registrada.
          </p>
          <form action={`/grupos/${idGrupo}/integrantes`} className="mt-3 flex max-w-2xl gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Nombre o correo exacto"
              className="flex-1 rounded-md border border-border-strong px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium hover:bg-bg">
              Buscar
            </button>
          </form>

          {q ? (
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-md border border-border">
              {resultadosBusqueda.map((persona) => (
                <li key={persona.idUsuario} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="flex items-center gap-3">
                    <Avatar nombre={persona.nombre} apellidos={persona.apellidos} fotoUrl={persona.fotoUrl} />
                    <span>
                      <Link href={`/usuarios/${persona.idUsuario}`} className="block font-medium hover:text-primary hover:underline">
                        {persona.nombre} {persona.apellidos ?? ""}
                      </Link>
                      <span className="text-xs text-text-muted">{persona.correo}</span>
                    </span>
                  </span>
                  {idsYaEnGrupo.has(persona.idUsuario) ? (
                    <span className="text-xs text-text-muted">Ya pertenece o fue invitado</span>
                  ) : (
                    <form action={invitar}>
                      <input type="hidden" name="idUsuario" value={persona.idUsuario} />
                      <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover">
                        Invitar
                      </button>
                    </form>
                  )}
                </li>
              ))}
              {resultadosBusqueda.length === 0 ? (
                <li className="px-4 py-5 text-center text-sm text-text-muted">
                  No encontramos personas con esa búsqueda.
                </li>
              ) : null}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
