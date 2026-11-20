import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarPlus, ExternalLink, MoreHorizontal, Settings, UserPlus, BookPlus } from "lucide-react";
import { PageHeader } from "@/components/ui-app/page-header";
import { CourseDot } from "@/components/ui-app/course-dot";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { aOracion } from "@/lib/presentacion";
import { diaMesCorto, fechaEnZonaLimaISO } from "@/lib/calendario";
import { yaImportoCurso } from "@/server/services/curso";
import { reunionEnCursoDelGrupo } from "@/server/services/reunion";
import { EnlaceProgramarReunion } from "@/components/ui-app/reuniones/enlace-programar";
import { FranjaEnCurso } from "@/components/ui-app/reuniones/franja-en-curso";
import { importarCursoAction } from "../../../cursos/actions";
import type { obtenerGrupoDelUsuario } from "@/server/services/grupo";

type DatosGrupo = Awaited<ReturnType<typeof obtenerGrupoDelUsuario>>;
export type PestanaGrupo = "tareas" | "horarios" | "integrantes" | "reuniones" | "actividad" | "configuracion";

const MAX_AVATARES = 4;

export async function EncabezadoGrupo({
  datos,
  idUsuario,
  activa,
  accionPrincipal,
  accionMovil,
  extra,
}: {
  datos: DatosGrupo;
  idUsuario: number;
  activa: PestanaGrupo;
  accionPrincipal?: ReactNode;
  /** Ícono de 44 px que va antes del menú en el encabezado móvil. */
  accionMovil?: ReactNode;
  extra?: ReactNode;
}) {
  const { grupo, rolActual } = datos;
  const idGrupo = grupo.idGrupo;
  const esLider = rolActual === "lider";
  const puedeParticipar = rolActual !== "observador" && grupo.estado === "activo";
  const curso = grupo.evaluacion?.curso ?? null;
  const puedeImportarCurso = curso !== null && curso.idUsuario !== idUsuario && !(await yaImportoCurso(idUsuario, curso.idCurso));
  // Franja "En curso" en todas las pestañas menos Reuniones (ahí la sección En curso cumple ese papel).
  const enCurso = activa === "reuniones" ? null : await reunionEnCursoDelGrupo(idUsuario, idGrupo);
  const franja = enCurso?.iniciadaEn ? { idReunion: enCurso.idReunion, titulo: enCurso.titulo, inicio: enCurso.inicio } : null;
  const integrantes = grupo.integrantes.filter((integrante) => integrante.estadoInvitacion === "aceptada");

  const pestanas = [
    { clave: "tareas", texto: "Tareas", href: `/grupos/${idGrupo}` },
    ...(rolActual !== "observador" ? [{ clave: "horarios", texto: "Horarios", href: `/grupos/${idGrupo}/horarios` }] : []),
    { clave: "integrantes", texto: "Integrantes", href: `/grupos/${idGrupo}/integrantes` },
    { clave: "reuniones", texto: "Reuniones", href: `/grupos/${idGrupo}/reuniones` },
    { clave: "actividad", texto: "Actividad", href: `/grupos/${idGrupo}/actividad` },
    ...(esLider ? [{ clave: "configuracion", texto: "Configuración", href: `/grupos/${idGrupo}/configuracion` }] : []),
  ].map((pestana) => ({ ...pestana, activa: pestana.clave === activa }));

  const contexto = (
    <>
      {curso ? (
        <span className="flex items-center gap-2">
          <CourseDot idCurso={curso.idCurso} />
          {aOracion(curso.nombre)}
        </span>
      ) : null}
      {grupo.evaluacion ? <><span aria-hidden>·</span><span>{grupo.evaluacion.nombre}</span></> : null}
      {grupo.fechaLimite ? (
        <>
          {curso || grupo.evaluacion ? <span aria-hidden>·</span> : null}
          <span>vence el {diaMesCorto(fechaEnZonaLimaISO(grupo.fechaLimite))}</span>
        </>
      ) : null}
      {grupo.estado === "finalizado" ? (
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Finalizado · solo lectura</span>
      ) : null}
    </>
  );

  const hayMenu = Boolean(grupo.enlaceTrabajo) || puedeParticipar || puedeImportarCurso;

  const menu = (claseBoton: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={claseBoton} aria-label="Más acciones del grupo">
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {grupo.enlaceTrabajo ? (
          <DropdownMenuItem asChild>
            <a href={grupo.enlaceTrabajo} target="_blank" rel="noreferrer noopener">
              <ExternalLink aria-hidden />
              Abrir documento del grupo
            </a>
          </DropdownMenuItem>
        ) : null}
        {puedeParticipar ? (
          <DropdownMenuItem asChild>
            <EnlaceProgramarReunion idGrupo={idGrupo}>
              <CalendarPlus aria-hidden />
              Programar reunión
            </EnlaceProgramarReunion>
          </DropdownMenuItem>
        ) : null}
        {esLider && grupo.estado === "activo" ? (
          <DropdownMenuItem asChild>
            <Link href={`/grupos/${idGrupo}/integrantes#invitar`}>
              <UserPlus aria-hidden />
              Invitar integrante
            </Link>
          </DropdownMenuItem>
        ) : null}
        {puedeImportarCurso ? (
          <form action={importarCursoAction.bind(null, idGrupo, `/grupos/${idGrupo}`)}>
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full">
                <BookPlus aria-hidden />
                Añadir el curso a los míos
              </button>
            </DropdownMenuItem>
          </form>
        ) : null}
        {esLider ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/grupos/${idGrupo}/configuracion`}>
                <Settings aria-hidden />
                Configuración
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
    <PageHeader
      migas={[{ href: "/grupos", texto: "Grupos" }, { texto: aOracion(grupo.nombre) }]}
      volver={{ href: "/grupos", texto: "Grupos" }}
      accionesMovil={
        hayMenu || accionMovil ? (
          <>
            {accionMovil}
            {hayMenu ? menu("size-11 [&_svg]:size-5") : null}
          </>
        ) : null
      }
      titulo={aOracion(grupo.nombre)}
      contexto={contexto}
      pestanas={pestanas}
      extra={
        <>
          {extra}
          {franja ? (
            <div className="-mx-4 mt-3 md:hidden">
              <FranjaEnCurso reunion={franja} puedeUnirse={rolActual !== "observador"} />
            </div>
          ) : null}
        </>
      }
      acciones={
        <>
          <Link href={`/grupos/${idGrupo}/integrantes`} className="flex" aria-label={`${integrantes.length} integrantes`}>
            {integrantes.slice(0, MAX_AVATARES).map((integrante, indice) => (
              <UserAvatar
                key={integrante.idUsuario}
                usuario={integrante.usuario}
                tamano="md"
                className={indice > 0 ? "-ml-2 ring-2 ring-background" : "ring-2 ring-background"}
              />
            ))}
            {integrantes.length > MAX_AVATARES ? (
              <span className="-ml-2 flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] text-muted-foreground ring-2 ring-background">
                +{integrantes.length - MAX_AVATARES}
              </span>
            ) : null}
          </Link>
          {hayMenu ? menu("size-8") : null}
          {accionPrincipal}
        </>
      }
    />
    {franja ? (
      <div className="max-md:hidden">
        <FranjaEnCurso reunion={franja} puedeUnirse={rolActual !== "observador"} />
      </div>
    ) : null}
    </>
  );
}
