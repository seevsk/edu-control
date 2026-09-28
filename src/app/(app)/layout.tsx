import { requerirSesion } from "@/server/auth/session";
import { obtenerUsuarioActual } from "@/server/services/usuario";
import { listarInvitacionesPendientes } from "@/server/services/grupo";
import { Header } from "./_components/header";
import { SidebarNav, BottomNav } from "./_components/nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const sesion = await requerirSesion();
  const [usuario, invitaciones] = await Promise.all([
    obtenerUsuarioActual(sesion.idUsuario),
    listarInvitacionesPendientes(sesion.idUsuario),
  ]);

  return (
    <div className="flex h-dvh flex-col">
      <Header usuario={usuario} />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:block">
          <SidebarNav invitacionesPendientes={invitaciones.length} />
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-bg p-4 sm:p-6">{children}</main>
      </div>

      <div className="shrink-0 md:hidden">
        <BottomNav invitacionesPendientes={invitaciones.length} />
      </div>
    </div>
  );
}
