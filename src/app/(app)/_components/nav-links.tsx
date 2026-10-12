"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";

function esActivo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ invitacionesPendientes = 0 }: { invitacionesPendientes?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map(({ href, label, Icon }) => {
        const activo = esActivo(pathname, href);
        const contador = href === "/invitaciones" ? invitacionesPendientes : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              activo
                ? "bg-primary-soft text-primary font-medium"
                : "text-text-muted hover:bg-primary-soft/60 hover:text-text"
            }`}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {label}
            {contador > 0 ? (
              <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[11px] leading-none text-white">
                {contador}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ invitacionesPendientes = 0 }: { invitacionesPendientes?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegacion principal"
      className="grid grid-cols-7 border-t border-border bg-surface"
    >
      {navItems.map(({ href, label, Icon }) => {
        const activo = esActivo(pathname, href);
        const contador = href === "/invitaciones" ? invitacionesPendientes : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            aria-label={label}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${
              activo ? "text-primary" : "text-text-muted"
            }`}
          >
            <span className="relative">
              <Icon className="size-5" aria-hidden />
              {contador > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] text-white">
                  {contador}
                </span>
              ) : null}
            </span>
            <span className="truncate px-0.5">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
