import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerPerfilPublico } from "@/server/services/perfil";
import { Avatar } from "@/components/avatar";
import { IconCalendario } from "@/components/icons";

const TIPO_CUENTA = { estudiante: "Estudiante", profesor: "Profesor" } as const;

export default async function PerfilUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idUsuario = Number(id);
  if (!Number.isInteger(idUsuario)) notFound();

  const sesion = await requerirSesion();
  if (idUsuario === sesion.idUsuario) redirect("/perfil");

  const usuario = await obtenerPerfilPublico(sesion.idUsuario, idUsuario);
  if (!usuario) notFound();

  const { perfil } = usuario;
  const datos: { etiqueta: string; valor: React.ReactNode }[] = [
    { etiqueta: "Tipo de cuenta", valor: TIPO_CUENTA[perfil.tipoCuenta] },
    { etiqueta: "Nombres", valor: usuario.nombre },
    { etiqueta: "Apellidos", valor: usuario.apellidos },
    { etiqueta: "Institución", valor: perfil.institucion },
    { etiqueta: "Carrera", valor: perfil.carrera },
    { etiqueta: "Ciclo", valor: perfil.ciclo },
    {
      etiqueta: "Trabaja además de estudiar",
      valor: (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
            perfil.trabaja ? "bg-cat-laboral-bg text-cat-laboral-fg" : "bg-bg text-text-muted"
          }`}
        >
          <span className={`size-1.5 rounded-full ${perfil.trabaja ? "bg-cat-laboral" : "bg-text-muted"}`} aria-hidden />
          {perfil.trabaja ? "Sí" : "No"}
        </span>
      ),
    },
  ];

  return (
    <div className="animate-page-in mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar nombre={usuario.nombre} apellidos={usuario.apellidos} fotoUrl={usuario.fotoUrl} tamano="lg" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">
              {usuario.nombre} {usuario.apellidos ?? ""}
            </h1>
            <p className="mt-0.5 text-sm text-text-muted">{TIPO_CUENTA[perfil.tipoCuenta]}</p>
          </div>
        </div>

        {usuario.puedeVerDisponibilidad ? (
          <Link
            href={`/usuarios/${idUsuario}/disponibilidad`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover"
          >
            <IconCalendario className="size-4" aria-hidden />
            Ver disponibilidad
          </Link>
        ) : (
          <button
            type="button"
            disabled
            title="Solo compañeros de un mismo grupo"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-text-muted opacity-60"
          >
            <IconCalendario className="size-4" aria-hidden />
            Ver disponibilidad
          </button>
        )}
      </div>

      <section className="rounded-md border border-border bg-surface">
        <dl className="divide-y divide-border">
          {datos.map((dato) => (
            <div key={dato.etiqueta} className="grid grid-cols-1 gap-0.5 px-4 py-2.5 text-sm sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt className="text-text-muted">{dato.etiqueta}</dt>
              <dd className="font-medium">{dato.valor ?? <span className="font-normal text-text-muted">—</span>}</dd>
            </div>
          ))}
          <div className="grid grid-cols-1 gap-0.5 px-4 py-2.5 text-sm sm:grid-cols-[14rem_1fr] sm:gap-4">
            <dt className="text-text-muted">Biografía</dt>
            <dd className="max-w-prose leading-relaxed">
              {perfil.biografia ?? <span className="text-text-muted">—</span>}
            </dd>
          </div>
        </dl>
      </section>

      {usuario.gruposEnComun.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Grupos en común</h2>
          <ul className="flex flex-wrap gap-2">
            {usuario.gruposEnComun.map((grupo) => (
              <li key={grupo.idGrupo}>
                <Link
                  href={`/grupos/${grupo.idGrupo}`}
                  className="block rounded-md border border-border bg-surface px-3 py-1.5 text-sm transition-colors duration-150 hover:border-primary/50 hover:text-primary"
                >
                  {grupo.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
