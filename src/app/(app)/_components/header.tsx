import Link from "next/link";
import { IconBuscarPersonas, IconCampana } from "@/components/icons";
import { Avatar } from "@/components/avatar";

export function Header({
  usuario,
  notificacionesNoLeidas = 0,
}: {
  usuario: { nombre: string; apellidos: string | null; fotoUrl: string | null };
  notificacionesNoLeidas?: number;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <span className="text-[15px] font-semibold tracking-tight">EduControl</span>

      <form action="/usuarios" role="search" className="hidden flex-1 items-center justify-end pr-2 sm:flex">
        <label className="flex w-full max-w-64 items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1 text-sm text-text-muted focus-within:border-primary">
          <IconBuscarPersonas className="size-4 shrink-0" aria-hidden />
          <span className="sr-only">Buscar personas</span>
          <input
            type="search"
            name="q"
            placeholder="Buscar personas"
            className="w-full bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
          />
        </label>
      </form>

      <div className="ml-auto flex items-center gap-3 sm:ml-0">
        <Link href="/usuarios" className="sm:hidden" aria-label="Buscar personas">
          <IconBuscarPersonas className="size-5 text-text-muted" aria-hidden />
        </Link>
        <Link href="/notificaciones" className="relative" aria-label="Notificaciones">
          <IconCampana className="size-5 text-text-muted" aria-hidden />
          {notificacionesNoLeidas > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] text-white">
              {notificacionesNoLeidas > 9 ? "9+" : notificacionesNoLeidas}
            </span>
          ) : null}
        </Link>

        <div className="flex items-center gap-2">
          <Avatar nombre={usuario.nombre} apellidos={usuario.apellidos} fotoUrl={usuario.fotoUrl} />
          <span className="hidden text-sm font-medium md:inline">{usuario.nombre}</span>
        </div>

        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="rounded-md border border-border px-2.5 py-1 text-xs text-text-muted hover:bg-bg"
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
