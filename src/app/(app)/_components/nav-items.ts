import {
  IconInicio,
  IconCursos,
  IconCalendario,
  IconGrupos,
  IconInvitaciones,
  IconPerfil,
} from "@/components/icons";

export const navItems = [
  { href: "/", label: "Inicio", Icon: IconInicio },
  { href: "/cursos", label: "Cursos", Icon: IconCursos },
  { href: "/calendario", label: "Calendario", Icon: IconCalendario },
  { href: "/grupos", label: "Grupos", Icon: IconGrupos },
  { href: "/invitaciones", label: "Invitaciones", Icon: IconInvitaciones },
  { href: "/perfil", label: "Perfil", Icon: IconPerfil },
] as const;
