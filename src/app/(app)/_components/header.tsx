import { IconBuscar, IconCampana } from "@/components/icons";
import { Avatar } from "@/components/avatar";

export function Header({
  usuario,
}: {
  usuario: { nombre: string; apellidos: string | null; fotoUrl: string | null };
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <span className="text-[15px] font-semibold tracking-tight">EduControl</span>

      <div className="hidden flex-1 items-center justify-end pr-2 sm:flex">
        <div className="flex w-full max-w-64 items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1 text-sm text-text-muted">
          <IconBuscar className="size-4 shrink-0" aria-hidden />
          <input
            type="search"
            placeholder="Buscar"
            disabled
            className="w-full bg-transparent text-sm placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3 sm:ml-0">
        <IconCampana className="size-5 text-text-muted" aria-hidden />

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
