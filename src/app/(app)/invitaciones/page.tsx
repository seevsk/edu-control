import { requerirSesion } from "@/server/auth/session";
import { listarInvitacionesPendientes } from "@/server/services/grupo";
import { responderInvitacionAction } from "../grupos/actions";

export default async function InvitacionesPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error } = await searchParams;
  const invitaciones = await listarInvitacionesPendientes(sesion.idUsuario);

  return (
    <div className="animate-page-in mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Invitaciones</h1>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {invitaciones.map((invitacion) => (
          <li
            key={invitacion.idIntegrante}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-4"
          >
            <div>
              <p className="text-sm font-medium">{invitacion.grupo.nombre}</p>
              <p className="text-xs text-text-muted">
                Invito {invitacion.grupo.creador.nombre} {invitacion.grupo.creador.apellidos ?? ""}
              </p>
            </div>
            {invitacion.grupo.estado === "finalizado" ? (
              <p className="text-xs text-text-muted">Grupo finalizado · Solo lectura</p>
            ) : (
              <div className="flex gap-2">
                <form action={responderInvitacionAction.bind(null, invitacion.idGrupo, "aceptada")}>
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
                  >
                    Aceptar
                  </button>
                </form>
                <form action={responderInvitacionAction.bind(null, invitacion.idGrupo, "rechazada")}>
                  <button
                    type="submit"
                    className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium hover:bg-bg"
                  >
                    Rechazar
                  </button>
                </form>
              </div>
            )}
          </li>
        ))}
        {invitaciones.length === 0 ? (
          <p className="text-sm text-text-muted">No tienes invitaciones pendientes.</p>
        ) : null}
      </ul>
    </div>
  );
}
