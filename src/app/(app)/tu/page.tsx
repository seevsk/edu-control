import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronRight, LogOut, Palette, Pencil, Plus, Search } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { obtenerPerfilCompleto } from "@/server/services/perfil";
import { listarCursos } from "@/server/services/curso";
import { listarMisReuniones } from "@/server/services/reunion";
import { rangoHoras } from "@/lib/formato-fecha";
import { aOracion } from "@/lib/presentacion";
import { formatoTitulo } from "@/lib/nombres";
import { PaginaCompleta, ACCION_MOVIL } from "@/components/ui-app/page-header";
import { Migas } from "@/components/ui-app/barra-superior";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { CourseDot } from "@/components/ui-app/course-dot";
import { SelectorTema } from "@/components/ui-app/selector-tema";
import { SwitchVisibilidad } from "../perfil/_components/interactivos";

export const metadata: Metadata = { title: "Tú" };

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MODALIDAD = { presencial: "Presencial", remoto: "Remoto" } as const;
const FILA = "flex min-h-14 items-center gap-3 border-b border-border-subtle px-4 py-2.5 hover:bg-muted md:px-6";
const ICONO = "flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground [&_svg]:size-4";

const partes = (time: Date) => ({ horas: time.getUTCHours(), minutos: time.getUTCMinutes() });

function Seccion({ titulo, cantidad, accion, children }: { titulo: string; cantidad?: number; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={titulo}>
      <div className="flex items-center gap-2 px-4 pt-6 pb-2 text-[13px] font-semibold text-muted-foreground md:px-6">
        <h2>{titulo}</h2>
        {cantidad !== undefined ? <span className="font-normal text-subtle-foreground">{cantidad}</span> : null}
        <span className="flex-1" />
        {accion}
      </div>
      <div className="border-t border-border-subtle">{children}</div>
    </section>
  );
}

/** "Tú" (destino móvil de Claude Design): tu perfil en corto, tus cursos y la cuenta. */
export default async function TuPage() {
  const sesion = await requerirSesion();
  const [usuario, cursos, reuniones] = await Promise.all([
    obtenerPerfilCompleto(sesion.idUsuario),
    listarCursos(sesion.idUsuario, true),
    listarMisReuniones(sesion.idUsuario),
  ]);
  if (!usuario.perfil) redirect("/api/auth/sesion-invalida");
  const perfil = usuario.perfil;
  const resumen = [perfil.carrera, perfil.ciclo ? `${perfil.ciclo}.º ciclo` : null].filter(Boolean).join(" · ") || (perfil.tipoCuenta === "profesor" ? "Profesor" : "Estudiante");
  const proximas = reuniones.proximas.length;

  return (
    <PaginaCompleta>
      <Migas items={[{ texto: "Tú" }]} />
      <div className="mx-auto w-full max-w-2xl pb-6">
        <header className="px-4 pt-3 pb-2 md:px-6 md:pt-6">
          <div className="-mx-2 flex h-11 items-center justify-end gap-1 md:hidden">
            <Link href="/usuarios" aria-label="Buscar personas" className={ACCION_MOVIL}><Search aria-hidden /></Link>
            <Link href="/perfil?editar=1" aria-label="Editar perfil" className={ACCION_MOVIL}><Pencil aria-hidden /></Link>
          </div>
          <h1 className="text-[30px] leading-tight font-bold tracking-[-0.03em] md:text-xl md:font-semibold md:tracking-[-0.01em]">Tú</h1>
        </header>

        <Link href="/perfil" className="flex items-center gap-4 px-4 py-3 hover:bg-muted md:px-6">
          <UserAvatar usuario={usuario} className="size-[60px] text-[25px]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-semibold">{formatoTitulo(`${usuario.nombre} ${usuario.apellidos ?? ""}`)}</span>
            <span className="block truncate text-[13px] text-muted-foreground">{resumen}</span>
          </span>
          <ChevronRight className="size-4 text-subtle-foreground" aria-hidden />
        </Link>

        <Seccion
          titulo="Cursos"
          cantidad={cursos.length}
          accion={
            <Link href="/cursos?nuevo=1" aria-label="Agregar curso" className="-my-2 flex size-11 items-center justify-center rounded-full text-foreground hover:bg-secondary">
              <Plus className="size-[18px]" aria-hidden />
            </Link>
          }
        >
          {cursos.length ? (
            cursos.map((curso) => {
              const primera = curso.horarios[0];
              const horario = primera
                ? `${DIAS[primera.diaSemana - 1]} ${rangoHoras(partes(primera.horaInicio), partes(primera.horaFin))}${curso.horarios.length > 1 ? ` +${curso.horarios.length - 1}` : ""}`
                : "Sin horario";
              return (
                <Link key={curso.idCurso} href={`/cursos/${curso.idCurso}`} className={FILA}>
                  <span className={ICONO}><CourseDot idCurso={curso.idCurso} className="size-2.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{aOracion(curso.nombre)}</span>
                    <span className="block truncate text-[13px] text-subtle-foreground">
                      {[horario, curso.modalidad ? MODALIDAD[curso.modalidad] : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-subtle-foreground" aria-hidden />
                </Link>
              );
            })
          ) : (
            <Link href="/cursos?nuevo=1" className={`${FILA} text-[15px] text-muted-foreground`}>Agrega tu primer curso</Link>
          )}
          {cursos.length ? <Link href="/cursos" className="flex h-11 items-center px-4 text-[13px] text-muted-foreground hover:text-foreground md:px-6">Ver todos los cursos</Link> : null}
        </Seccion>

        <Seccion titulo="Cuenta">
          <Link href="/reuniones" className={FILA}>
            <span className={ICONO}><CalendarDays aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px]">Reuniones</span>
              <span className="block text-[13px] text-subtle-foreground">{proximas ? `${proximas} ${proximas === 1 ? "próxima" : "próximas"}` : "Sin reuniones próximas"}</span>
            </span>
            <ChevronRight className="size-4 text-subtle-foreground" aria-hidden />
          </Link>
          <div className={FILA}>
            <span className={ICONO}><Search aria-hidden /></span>
            <label htmlFor="visible-en-busqueda" className="min-w-0 flex-1 text-[15px]">Aparecer en búsquedas</label>
            <SwitchVisibilidad inicial={perfil.visibleEnBusqueda} />
          </div>
          <div className={FILA}>
            <span className={ICONO}><Palette aria-hidden /></span>
            <label htmlFor="tema" className="min-w-0 flex-1 text-[15px]">Apariencia</label>
            <SelectorTema id="tema" />
          </div>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className={`${FILA} w-full text-left`}>
              <span className={ICONO}><LogOut aria-hidden /></span>
              <span className="min-w-0 flex-1 text-[15px]">Cerrar sesión</span>
            </button>
          </form>
        </Seccion>
      </div>
    </PaginaCompleta>
  );
}
