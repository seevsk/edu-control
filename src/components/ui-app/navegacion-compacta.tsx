"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, House, Inbox, Menu, User, Users, type LucideIcon } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import type { DatosSidebar } from "./app-sidebar";

interface Destino {
  href: string;
  texto: string;
  Icono: LucideIcon;
  /** Rutas que también marcan este destino como activo. */
  incluye?: string[];
  contador?: boolean;
}

const INICIO: Destino = { href: "/", texto: "Inicio", Icono: House };
const GRUPOS: Destino = { href: "/grupos", texto: "Grupos", Icono: Users };
const CALENDARIO: Destino = { href: "/calendario", texto: "Calendario", Icono: CalendarDays };
const BANDEJA: Destino = { href: "/notificaciones", texto: "Bandeja", Icono: Inbox, contador: true };

/** Móvil (< 768 px): 5 destinos. "Tú" reúne perfil, cursos, reuniones y la cuenta. */
const MOVIL: Destino[] = [INICIO, GRUPOS, CALENDARIO, BANDEJA, { href: "/tu", texto: "Tú", Icono: User, incluye: ["/perfil", "/cursos", "/reuniones", "/usuarios"] }];
/** Tablet (768–1023 px): riel con Cursos; el resto del menú se abre desde "Menú". */
const RIEL: Destino[] = [INICIO, GRUPOS, CALENDARIO, BANDEJA, { href: "/cursos", texto: "Cursos", Icono: BookOpen }];

function activo(pathname: string, destino: Destino) {
  const coincide = (ruta: string) => (ruta === "/" ? pathname === "/" : pathname === ruta || pathname.startsWith(`${ruta}/`));
  return coincide(destino.href) || (destino.incluye ?? []).some(coincide);
}

function Contador({ valor }: { valor: number }) {
  if (valor <= 0) return null;
  return (
    <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
      {valor > 99 ? "99+" : valor}
    </span>
  );
}

function Item({ destino, pathname, contador, variante }: { destino: Destino; pathname: string; contador: number; variante: "barra" | "riel" }) {
  const actual = activo(pathname, destino);
  return (
    <Link
      href={destino.href}
      aria-current={actual ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 text-[11px] font-medium text-subtle-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring",
        variante === "barra" ? "min-w-0 flex-1 pt-2" : "w-16 py-1",
        actual && "font-semibold text-foreground",
      )}
    >
      <span className={cn("relative flex h-7 w-[52px] items-center justify-center rounded-full", actual && "bg-secondary")}>
        <destino.Icono className="size-[21px]" strokeWidth={actual ? 1.9 : 1.7} aria-hidden />
        {destino.contador ? <Contador valor={contador} /> : null}
      </span>
      <span className="truncate">{destino.texto}</span>
    </Link>
  );
}

/** Barra inferior en móvil y riel lateral en tablet (patrón de Claude Design, "Móvil" y "Tablet"). */
export function NavegacionCompacta({ datos }: { datos: DatosSidebar }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {MOVIL.map((destino) => (
          <Item key={destino.href} destino={destino} pathname={pathname} contador={datos.bandejaNoLeidas} variante="barra" />
        ))}
      </nav>

      <nav aria-label="Principal" className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center gap-4 border-r bg-sidebar py-5 md:flex lg:hidden">
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          aria-label="Abrir menú completo"
          className="mb-1 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        {RIEL.map((destino) => (
          <Item key={destino.href} destino={destino} pathname={pathname} contador={datos.bandejaNoLeidas} variante="riel" />
        ))}
        <Link href="/perfil" aria-label="Tu perfil" className="mt-auto rounded-full focus-visible:outline-2 focus-visible:outline-ring">
          <UserAvatar usuario={datos.usuario} tamano="lg" />
        </Link>
      </nav>
    </>
  );
}
