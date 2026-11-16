import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen, Briefcase, CalendarDays, Clock } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { obtenerPerfilPublico } from "@/server/services/perfil";
import { mesAnio } from "@/lib/formato-fecha";
import { aOracion } from "@/lib/presentacion";
import { formatoTitulo, nombreCorto } from "@/lib/nombres";
import { PaginaCompleta } from "@/components/ui-app/page-header";
import { Migas } from "@/components/ui-app/barra-superior";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { CourseDot } from "@/components/ui-app/course-dot";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const TIPO_CUENTA = { estudiante: "Estudiante", profesor: "Profesor" } as const;
const ROLES = { lider: "Líder", miembro: "Miembro", observador: "Observador" } as const;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const sesion = await requerirSesion();
  const usuario = Number.isInteger(Number(id)) ? await obtenerPerfilPublico(sesion.idUsuario, Number(id)) : null;
  return { title: usuario ? nombreCorto(usuario.nombre, usuario.apellidos) : "Perfil" };
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border-subtle py-2.5 text-sm">
      <dt className="w-40 shrink-0 text-subtle-foreground">{etiqueta}</dt>
      <dd className="min-w-[200px] flex-1">{children ?? <span className="text-subtle-foreground">—</span>}</dd>
    </div>
  );
}

/** Perfil de otra persona (AGENTS.md 8.1): datos básicos y grupos en común, nunca el correo. */
export default async function PerfilUsuarioPage({ params }: Props) {
  const { id } = await params;
  const idUsuario = Number(id);
  if (!Number.isInteger(idUsuario)) notFound();

  const sesion = await requerirSesion();
  if (idUsuario === sesion.idUsuario) redirect("/perfil");

  const usuario = await obtenerPerfilPublico(sesion.idUsuario, idUsuario);
  if (!usuario) notFound();

  const { perfil } = usuario;
  const nombreCompleto = formatoTitulo(`${usuario.nombre} ${usuario.apellidos ?? ""}`);
  const tipo = TIPO_CUENTA[perfil.tipoCuenta];
  const resumen = [tipo, perfil.carrera, perfil.ciclo ? `${perfil.ciclo}.º ciclo` : null].filter(Boolean).join(" · ");
  const botonDisponibilidad = (
    <Button size="sm" variant={usuario.puedeVerDisponibilidad ? "default" : "outline"} disabled={!usuario.puedeVerDisponibilidad} asChild={usuario.puedeVerDisponibilidad}>
      {usuario.puedeVerDisponibilidad ? (
        <Link href={`/usuarios/${idUsuario}/disponibilidad`}><CalendarDays aria-hidden />Ver disponibilidad</Link>
      ) : (
        <span><CalendarDays aria-hidden />Ver disponibilidad</span>
      )}
    </Button>
  );

  return (
    <PaginaCompleta>
      <Migas items={[{ href: "/usuarios", texto: "Personas" }, { texto: nombreCorto(usuario.nombre, usuario.apellidos) }]} />
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-8 px-4 py-8 sm:px-8">
        <section className="flex flex-wrap items-start gap-5">
          <UserAvatar usuario={{ idUsuario, nombre: usuario.nombre, apellidos: usuario.apellidos, fotoUrl: usuario.fotoUrl }} className="size-[72px] text-3xl" />
          <div className="min-w-[260px] flex-1">
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">{nombreCompleto}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{resumen}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-[13px] text-muted-foreground">
              {perfil.institucion ? <span className="inline-flex items-center gap-1.5"><BookOpen className="size-3.5" aria-hidden />{perfil.institucion}</span> : null}
              {perfil.trabaja ? <span className="inline-flex items-center gap-1.5"><Briefcase className="size-3.5" aria-hidden />Trabaja y estudia</span> : null}
              <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden />Miembro desde {mesAnio(usuario.fechaRegistro)}</span>
            </div>
          </div>
          {usuario.puedeVerDisponibilidad ? (
            botonDisponibilidad
          ) : (
            <Tooltip>
              <TooltipTrigger asChild><span tabIndex={0}>{botonDisponibilidad}</span></TooltipTrigger>
              <TooltipContent>Solo entre compañeros de un mismo grupo</TooltipContent>
            </Tooltip>
          )}
        </section>

        {perfil.biografia ? <p className="max-w-2xl text-sm whitespace-pre-wrap text-muted-foreground">{perfil.biografia}</p> : null}

        <div className="flex flex-wrap items-start gap-10">
          <section className="min-w-0 flex-[2_1_480px]">
            <h2 className="mb-2 text-sm font-semibold">Información</h2>
            <dl>
              <Dato etiqueta="Tipo de cuenta">{tipo}</Dato>
              <Dato etiqueta="Nombres">{formatoTitulo(usuario.nombre)}</Dato>
              <Dato etiqueta="Apellidos">{usuario.apellidos ? formatoTitulo(usuario.apellidos) : null}</Dato>
              <Dato etiqueta="Institución">{perfil.institucion}</Dato>
              <Dato etiqueta="Carrera">{perfil.carrera}</Dato>
              <Dato etiqueta="Ciclo">{perfil.ciclo ? `${perfil.ciclo}.º ciclo` : null}</Dato>
              <Dato etiqueta="Trabaja">{perfil.trabaja ? "Sí, además de estudiar" : "No"}</Dato>
            </dl>
          </section>

          <aside className="min-w-0 flex-[1_1_260px]">
            <h2 className="mb-2 text-sm font-semibold">Grupos en común</h2>
            {usuario.gruposEnComun.length ? (
              <ul>
                {usuario.gruposEnComun.map((grupo) => (
                  <li key={grupo.idGrupo}>
                    <Link href={`/grupos/${grupo.idGrupo}`} className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-[13px] hover:bg-muted">
                      {grupo.curso ? <CourseDot idCurso={grupo.curso.idCurso} /> : <span className="size-2 shrink-0 rounded-[2px] bg-secondary" aria-hidden />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{aOracion(grupo.nombre)}</span>
                        <span className="block truncate text-xs text-subtle-foreground">
                          {grupo.curso ? aOracion(grupo.curso.nombre) : "Sin curso"}{grupo.activo ? "" : " · finalizado"}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">{ROLES[grupo.rol]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-subtle-foreground">Ninguno por ahora.</p>
            )}
          </aside>
        </div>
      </div>
    </PaginaCompleta>
  );
}
