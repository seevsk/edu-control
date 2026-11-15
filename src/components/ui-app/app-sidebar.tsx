"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronsUpDown, House, Inbox, LogOut, Mail, Plus, User, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { CourseDot } from "./course-dot";
import { UserAvatar } from "./user-avatar";

export interface DatosSidebar {
  usuario: { idUsuario: number; nombre: string; apellidos: string | null; fotoUrl: string | null };
  nombreVisible: string;
  bandejaNoLeidas: number;
  invitacionesPendientes: number;
  cursos: { idCurso: number; nombre: string }[];
  grupos: { idGrupo: number; nombre: string }[];
}

const NAVEGACION = [
  { href: "/", texto: "Tu trabajo", Icono: House },
  { href: "/notificaciones", texto: "Bandeja", Icono: Inbox, contador: "bandeja" },
  { href: "/calendario", texto: "Calendario", Icono: CalendarDays },
  { href: "/reuniones", texto: "Reuniones", Icono: Users },
  { href: "/invitaciones", texto: "Invitaciones", Icono: Mail, contador: "invitaciones" },
] as const;

/** Claro: item activo blanco en relieve; oscuro: fondo apenas mas claro. */
const ACTIVO = "data-[active=true]:bg-background data-[active=true]:font-normal data-[active=true]:shadow-[0_1px_2px_rgba(24,24,27,0.06),0_0_0_1px_var(--sidebar-border)] dark:data-[active=true]:bg-sidebar-accent dark:data-[active=true]:shadow-none";

function esActivo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ datos }: { datos: DatosSidebar }) {
  const pathname = usePathname();
  const contadores = { bandeja: datos.bandejaNoLeidas, invitaciones: datos.invitacionesPendientes };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="font-semibold">
              <Link href="/">
                <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">
                  E
                </span>
                <span className="text-sm">EduControl</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAVEGACION.map((item) => {
              const contador = "contador" in item ? contadores[item.contador] : 0;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild className={ACTIVO} isActive={esActivo(pathname, item.href)} tooltip={item.texto}>
                    <Link href={item.href}>
                      <item.Icono aria-hidden />
                      <span>{item.texto}</span>
                    </Link>
                  </SidebarMenuButton>
                  {contador > 0 ? <SidebarMenuBadge>{contador > 99 ? "99+" : contador}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel asChild>
            <Link href="/cursos">Cursos</Link>
          </SidebarGroupLabel>
          <SidebarGroupAction asChild title="Agregar curso">
            <Link href="/cursos?nuevo=1" aria-label="Agregar curso"><Plus aria-hidden /></Link>
          </SidebarGroupAction>
          <SidebarMenu>
            {datos.cursos.map((curso) => (
              <SidebarMenuItem key={curso.idCurso}>
                <SidebarMenuButton asChild className={ACTIVO} isActive={esActivo(pathname, `/cursos/${curso.idCurso}`)}>
                  <Link href={`/cursos/${curso.idCurso}`}>
                    <CourseDot idCurso={curso.idCurso} />
                    <span>{curso.nombre}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {datos.cursos.length === 0 ? (
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="text-subtle-foreground">
                  <Link href="/cursos">Registra tus cursos</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel asChild>
            <Link href="/grupos">Grupos</Link>
          </SidebarGroupLabel>
          <SidebarGroupAction asChild title="Crear grupo">
            <Link href="/grupos?nuevo=1" aria-label="Crear grupo"><Plus aria-hidden /></Link>
          </SidebarGroupAction>
          <SidebarMenu>
            {datos.grupos.map((grupo) => (
              <SidebarMenuItem key={grupo.idGrupo}>
                <SidebarMenuButton asChild className={ACTIVO} isActive={esActivo(pathname, `/grupos/${grupo.idGrupo}`)}>
                  <Link href={`/grupos/${grupo.idGrupo}`}>
                    <span>{grupo.nombre}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {datos.grupos.length === 0 ? (
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="text-subtle-foreground">
                  <Link href="/grupos">Crea o únete a un grupo</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip={datos.nombreVisible}>
                  <UserAvatar usuario={datos.usuario} tamano="md" />
                  <span className="flex-1 truncate">{datos.nombreVisible}</span>
                  <ChevronsUpDown className="text-subtle-foreground" aria-hidden />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{datos.nombreVisible}</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/perfil">
                    <User aria-hidden />
                    Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <ThemeToggle />
                <DropdownMenuSeparator />
                <form action="/api/auth/logout" method="POST">
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut aria-hidden />
                      Salir
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
