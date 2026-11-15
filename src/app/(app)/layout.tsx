import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { requerirSesion } from "@/server/auth/session";
import { obtenerUsuarioActual } from "@/server/services/usuario";
import { listarInvitacionesPendientes, listarMisGrupos } from "@/server/services/grupo";
import { listarCursos } from "@/server/services/curso";
import { contarNotificacionesNoLeidas } from "@/server/services/notificacion";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui-app/app-sidebar";
import { aOracion } from "@/lib/presentacion";
import { nombreCorto } from "@/lib/nombres";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const sesion = await requerirSesion();
  const [usuario, invitaciones, notificacionesNoLeidas, cursos, grupos, almacen] = await Promise.all([
    obtenerUsuarioActual(sesion.idUsuario),
    listarInvitacionesPendientes(sesion.idUsuario),
    contarNotificacionesNoLeidas(sesion.idUsuario),
    listarCursos(sesion.idUsuario, true),
    listarMisGrupos(sesion.idUsuario),
    cookies(),
  ]);

  const datos = {
    usuario: { idUsuario: usuario.idUsuario, nombre: usuario.nombre, apellidos: usuario.apellidos, fotoUrl: usuario.fotoUrl },
    nombreVisible: nombreCorto(usuario.nombre, usuario.apellidos),
    bandejaNoLeidas: notificacionesNoLeidas,
    invitacionesPendientes: invitaciones.length,
    cursos: cursos.map((curso) => ({ idCurso: curso.idCurso, nombre: aOracion(curso.nombre) })),
    grupos: grupos
      .filter((grupo) => grupo.estado === "activo")
      .map((grupo) => ({ idGrupo: grupo.idGrupo, nombre: aOracion(grupo.nombre) })),
  };

  return (
    <SidebarProvider
      defaultOpen={almacen.get("sidebar_state")?.value !== "false"}
      style={{ "--sidebar-width": "15rem" } as CSSProperties}
      className="h-dvh"
    >
      <AppSidebar datos={datos} />
      <SidebarInset className="min-w-0 overflow-y-auto">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold">EduControl</span>
        </div>
        {/* Las paginas aun no migradas conservan su padding; las nuevas usan <PaginaCompleta>. */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
