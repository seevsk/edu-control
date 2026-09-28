import Image from "next/image";
import { IconBuscar, IconCampana } from "@/components/icons";

function iniciales(nombre: string, apellidos: string | null) {
  const segunda = apellidos?.trim()[0] ?? "";
  return `${nombre.trim()[0] ?? ""}${segunda}`.toUpperCase();
}

export function Header({
  usuario,
}: {
  usuario: { nombre: string; apellidos: string | null; fotoUrl: string | null };
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <span className="text-[15px] font-semibold tracking-tight">EduControl</span>

      <div className="ml-4 hidden flex-1 items-center gap-2 rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-text-muted sm:flex">
        <IconBuscar className="size-4 shrink-0" aria-hidden />
        <input
          type="search"
          placeholder="Buscar"
          disabled
          className="w-full bg-transparent placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <IconCampana className="size-5 text-text-muted" aria-hidden />

        <div className="flex items-center gap-2">
          {usuario.fotoUrl ? (
            <Image
              src={usuario.fotoUrl}
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-full"
            />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-xs font-medium text-primary">
              {iniciales(usuario.nombre, usuario.apellidos)}
            </span>
          )}
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
