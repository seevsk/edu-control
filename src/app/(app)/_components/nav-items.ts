import {
  IconInicio,
  IconCursos,
  IconCalendario,
  IconGrupos,
  IconInvitaciones,
  IconPerfil,
  IconReuniones,
} from "@/components/icons";

export const navItems = [
  { href: "/", label: "Inicio", Icon: IconInicio },
  { href: "/cursos", label: "Cursos", Icon: IconCursos },
  { href: "/calendario", label: "Calendario", Icon: IconCalendario },
  { href: "/grupos", label: "Grupos", Icon: IconGrupos },
  { href: "/reuniones", label: "Reuniones", Icon: IconReuniones },
  { href: "/invitaciones", label: "Invitaciones", Icon: IconInvitaciones },
  { href: "/perfil", label: "Perfil", Icon: IconPerfil },
] as const;
