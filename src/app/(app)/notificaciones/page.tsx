import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { listarNotificaciones } from "@/server/services/notificacion";
import { marcarNotificacionLeidaAction, marcarTodasLeidasAction } from "./actions";

export default async function NotificacionesPage() {
  const sesion = await requerirSesion();
  const notificaciones = await listarNotificaciones(sesion.idUsuario);
  const hayNoLeidas = notificaciones.some((n) => !n.leida);

  return (
    <div className="animate-page-in mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notificaciones</h1>
        {hayNoLeidas ? (
          <form action={marcarTodasLeidasAction}>
            <button type="submit" className="text-sm text-primary hover:underline">
              Marcar todas como leidas
            </button>
          </form>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2">
        {notificaciones.map((notificacion) => (
          <li
            key={notificacion.idNotificacion}
            className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${
              notificacion.leida ? "border-border bg-surface" : "border-primary/30 bg-primary-soft"
            }`}
          >
            <div>
              {notificacion.enlace ? (
                <Link href={notificacion.enlace} className="hover:underline">
                  {notificacion.mensaje}
                </Link>
              ) : (
                <p>{notificacion.mensaje}</p>
              )}
              <p className="mt-0.5 text-xs text-text-muted">
                {notificacion.fechaCreacion.toLocaleString("es-PE", { timeZone: "America/Lima" })}
              </p>
            </div>
            {!notificacion.leida ? (
              <form action={marcarNotificacionLeidaAction.bind(null, notificacion.idNotificacion)}>
                <button type="submit" className="shrink-0 text-xs text-primary hover:underline">
                  Marcar leida
                </button>
              </form>
            ) : null}
          </li>
        ))}
        {notificaciones.length === 0 ? (
          <p className="text-sm text-text-muted">No tienes notificaciones todavia.</p>
        ) : null}
      </ul>
    </div>
  );
}
