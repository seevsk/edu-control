import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { buscarPersonas } from "@/server/services/grupo";
import { Avatar } from "@/components/avatar";
import { IconBuscarPersonas } from "@/components/icons";

export default async function BuscarPersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sesion = await requerirSesion();
  const { q } = await searchParams;
  const consulta = q?.trim() ?? "";
  const resultados = consulta ? await buscarPersonas(sesion.idUsuario, consulta) : [];

  return (
    <div className="animate-page-in mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-xl font-semibold">Personas</h1>

      <form action="/usuarios" role="search">
        <label className="flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm focus-within:border-primary">
          <IconBuscarPersonas className="size-4 shrink-0 text-text-muted" aria-hidden />
          <span className="sr-only">Buscar personas</span>
          <input
            type="search"
            name="q"
            defaultValue={consulta}
            placeholder="Nombre o correo exacto"
            autoFocus={!consulta}
            className="w-full bg-transparent placeholder:text-text-muted focus:outline-none"
          />
        </label>
      </form>

      {consulta ? (
        resultados.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
            {resultados.map((persona) => (
              <li key={persona.idUsuario}>
                <Link
                  href={`/usuarios/${persona.idUsuario}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-bg"
                >
                  <Avatar nombre={persona.nombre} apellidos={persona.apellidos} fotoUrl={persona.fotoUrl} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {persona.nombre} {persona.apellidos ?? ""}
                    </span>
                    {persona.carrera || persona.institucion ? (
                      <span className="block truncate text-xs text-text-muted">
                        {[persona.carrera, persona.institucion].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Sin resultados.</p>
        )
      ) : null}
    </div>
  );
}
