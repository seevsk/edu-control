import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerPerfilPublico } from "@/server/services/perfil";
import { DIAS_LARGOS, etiquetaMinutos } from "@/lib/calendario";
import { mapaDeDisponibilidad, type Franja } from "@/lib/disponibilidad";
import { Avatar } from "@/components/avatar";
import { MapaSemanal } from "@/components/mapa-semanal";

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
  const datos = [
    perfil.carrera,
    perfil.ciclo ? `Ciclo ${perfil.ciclo}` : null,
    perfil.institucion,
  ].filter(Boolean);

  const mapa = usuario.ocupados ? mapaDeDisponibilidad([{ idUsuario, ocupados: usuario.ocupados }]) : null;
  const describirFranja = (franja: Franja) =>
    `${DIAS_LARGOS[franja.diaSemana - 1]} ${etiquetaMinutos(franja.inicioMin)} – ${etiquetaMinutos(franja.finMin)} · ${
      franja.ocupados.length > 0 ? "ocupado" : "libre"
    }`;

  return (
    <div className="animate-page-in mx-auto flex max-w-3xl flex-col gap-6">
      <section className="flex items-start gap-4">
        <Avatar nombre={usuario.nombre} apellidos={usuario.apellidos} fotoUrl={usuario.fotoUrl} tamano="lg" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">
            {usuario.nombre} {usuario.apellidos ?? ""}
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {[TIPO_CUENTA[perfil.tipoCuenta], ...datos].join(" · ")}
          </p>
          {perfil.biografia ? <p className="mt-3 max-w-prose text-sm leading-relaxed">{perfil.biografia}</p> : null}
        </div>
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

      {mapa ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Horario</h2>
          <MapaSemanal
            etiqueta={`Horario semanal de ${usuario.nombre}`}
            mapa={mapa}
            claseDeFranja={(franja) => (franja.ocupados.length > 0 ? "bg-text-muted/45" : "bg-estado-completada/15")}
            describirFranja={describirFranja}
            leyenda={[
              { clase: "bg-text-muted/45", texto: "Ocupado" },
              { clase: "bg-estado-completada/15", texto: "Libre" },
            ]}
          />
        </section>
      ) : null}
    </div>
  );
}
