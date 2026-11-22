import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { listarMisGrupos } from "@/server/services/grupo";
import { listarEvaluacionesParaGrupo } from "@/server/services/curso";
import { crearGrupoAction } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { CampoSelect } from "@/components/ui-app/campo-select";
import { Toast } from "@/components/toast";
import { ACCION_MOVIL, ChipsFiltro, EncabezadoMovil, PaginaCompleta, PageHeader } from "@/components/ui-app/page-header";
import { PanelLateral } from "@/components/ui-app/panel-lateral";
import { CourseDot } from "@/components/ui-app/course-dot";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { DueChip } from "@/components/ui-app/due-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { aOracion } from "@/lib/presentacion";

export const metadata: Metadata = { title: "Grupos" };

const CAMPO = "flex flex-col gap-1.5 text-[13px] font-medium";
const ETIQUETAS_ROL = { lider: "Líder", miembro: "Miembro", observador: "Observador" } as const;
const MAX_AVATARES = 3;

export default async function GruposPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; toast?: string; vista?: string; nuevo?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error, toast, vista, nuevo } = await searchParams;
  const [grupos, evaluaciones] = await Promise.all([
    listarMisGrupos(sesion.idUsuario),
    listarEvaluacionesParaGrupo(sesion.idUsuario),
  ]);
  const verFinalizados = vista === "finalizados";
  const activos = grupos.filter((grupo) => grupo.estado === "activo");
  const finalizados = grupos.filter((grupo) => grupo.estado === "finalizado");
  const deVista = verFinalizados ? finalizados : activos;
  const ahora = new Date();
  const cerrarEn = verFinalizados ? "/grupos?vista=finalizados" : "/grupos";

  return (
    <PaginaCompleta>
      <Toast mensaje={toast} />
      <EncabezadoMovil
        titulo="Grupos"
        contexto={`${activos.length} ${activos.length === 1 ? "activo" : "activos"}`}
        acciones={
          <Link href="/grupos?nuevo=1" scroll={false} aria-label="Crear grupo" className={ACCION_MOVIL}>
            <Plus aria-hidden />
          </Link>
        }
      />
      <ChipsFiltro
        etiqueta="Estado de los grupos"
        className="border-b pb-3 md:hidden"
        opciones={[
          { href: "/grupos", texto: `Activos · ${activos.length}`, activa: !verFinalizados },
          { href: "/grupos?vista=finalizados", texto: `Finalizados · ${finalizados.length}`, activa: verFinalizados },
        ]}
      />
      <PageHeader
        ocultarEnMovil
        titulo="Grupos"
        contexto={<span>{activos.length} {activos.length === 1 ? "trabajo grupal activo" : "trabajos grupales activos"}</span>}
        acciones={
          <Button size="sm" asChild>
            <Link href="/grupos?nuevo=1" scroll={false}><Plus aria-hidden />Crear grupo</Link>
          </Button>
        }
        pestanas={[
          { href: "/grupos", texto: "Activos", activa: !verFinalizados, contador: activos.length },
          { href: "/grupos?vista=finalizados", texto: "Finalizados", activa: verFinalizados, contador: finalizados.length },
        ]}
      />

      {error && nuevo !== "1" ? <p role="alert" className="mx-4 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive sm:mx-8">{error}</p> : null}

      {deVista.length ? (
        <ul>
          {deVista.map((grupo) => {
            const integrantes = grupo.integrantes.filter((integrante) => integrante.estadoInvitacion === "aceptada");
            const rol = grupo.integrantes.find((integrante) => integrante.idUsuario === sesion.idUsuario)?.rol;
            const vigentes = grupo.tareas.filter((tarea) => tarea.estado !== "descartada");
            const completadas = vigentes.filter((tarea) => tarea.estado === "completada").length;
            const curso = grupo.evaluacion?.curso ?? null;
            return (
              <li key={grupo.idGrupo}>
                <Link href={`/grupos/${grupo.idGrupo}`} className="block border-b border-border-subtle px-4 py-3.5 hover:bg-muted md:hidden">
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 truncate text-base font-semibold">{aOracion(grupo.nombre)}</span>
                    <DueChip fecha={grupo.fechaLimite} cerrada={grupo.estado === "finalizado"} ahora={ahora} />
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-subtle-foreground">
                    {curso ? <><CourseDot idCurso={curso.idCurso} />{aOracion(curso.nombre)} · </> : null}
                    {rol ? ETIQUETAS_ROL[rol] : null}
                  </span>
                  <span className="mt-3 flex items-center gap-3">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
                      <span className="block h-full rounded-full bg-estado-completada" style={{ width: `${vigentes.length ? Math.round((completadas / vigentes.length) * 100) : 0}%` }} />
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{vigentes.length ? `${completadas} de ${vigentes.length}` : "Sin tareas"}</span>
                    <span className="flex">
                      {integrantes.slice(0, MAX_AVATARES).map((integrante, indice) => (
                        <UserAvatar key={integrante.idUsuario} usuario={integrante.usuario} className={indice > 0 ? "-ml-1.5 ring-2 ring-background" : "ring-2 ring-background"} />
                      ))}
                    </span>
                  </span>
                </Link>
                <Link href={`/grupos/${grupo.idGrupo}`} className="hidden min-h-[52px] items-center gap-4 border-b border-border-subtle px-4 py-2 text-[13px] hover:bg-muted sm:px-8 md:flex">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{aOracion(grupo.nombre)}</span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-subtle-foreground">
                      {curso ? <><CourseDot idCurso={curso.idCurso} />{aOracion(curso.nombre)} · </> : null}
                      {rol ? ETIQUETAS_ROL[rol] : null}
                    </span>
                  </span>
                  <span className="hidden items-center gap-2 text-xs text-muted-foreground tabular-nums sm:flex">
                    {vigentes.length ? `${completadas} de ${vigentes.length}` : "Sin tareas"}
                    {vigentes.length ? (
                      <span className="h-1 w-16 overflow-hidden rounded-full bg-secondary" aria-hidden>
                        <span className="block h-full rounded-full bg-estado-completada" style={{ width: `${Math.round((completadas / vigentes.length) * 100)}%` }} />
                      </span>
                    ) : null}
                  </span>
                  <span className="hidden md:flex">
                    {integrantes.slice(0, MAX_AVATARES).map((integrante, indice) => (
                      <UserAvatar key={integrante.idUsuario} usuario={integrante.usuario} className={indice > 0 ? "-ml-1.5 ring-2 ring-background" : "ring-2 ring-background"} />
                    ))}
                    {integrantes.length > MAX_AVATARES ? (
                      <span className="-ml-1.5 flex size-[22px] items-center justify-center rounded-full bg-secondary text-[10px] text-muted-foreground ring-2 ring-background">
                        +{integrantes.length - MAX_AVATARES}
                      </span>
                    ) : null}
                  </span>
                  <DueChip fecha={grupo.fechaLimite} cerrada={grupo.estado === "finalizado"} ahora={ahora} />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-4 py-16 text-center text-[13px] text-subtle-foreground sm:px-8">
          {verFinalizados ? (
            "Los grupos que finalices quedan aquí en solo lectura, con su historial de aporte."
          ) : (
            <>
              <p>Crea un grupo para tu trabajo en equipo: invitas a tus compañeros, repartes tareas con peso y ves quién avanzó.</p>
              <Button size="sm" className="mt-4" asChild>
                <Link href="/grupos?nuevo=1" scroll={false}><Plus aria-hidden />Crear el primero</Link>
              </Button>
            </>
          )}
        </div>
      )}

      {nuevo === "1" ? (
        <PanelLateral titulo="Crear grupo" cerrarEn={cerrarEn}>
          {error ? <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p> : null}
          <form action={crearGrupoAction} className="flex flex-col gap-4">
            <label className={CAMPO}>
              Nombre
              <Input name="nombre" required maxLength={120} placeholder="Proyecto final de desarrollo web" autoFocus />
            </label>
            <label className={CAMPO}>
              Descripción
              <Textarea name="descripcion" maxLength={500} rows={3} placeholder="Objetivo o alcance del trabajo" />
            </label>
            {evaluaciones.length > 0 ? (
              <label className={CAMPO}>
                Evaluación relacionada
                <CampoSelect
                  name="idEvaluacion"
                  opciones={[{ valor: "", texto: "Ninguna" }, ...evaluaciones.map((evaluacion) => ({ valor: String(evaluacion.idEvaluacion), texto: `${aOracion(evaluacion.curso.nombre)} · ${evaluacion.nombre}` }))]}
                />
                <span className="text-xs font-normal text-subtle-foreground">Su fecha de cierre será la fecha límite del grupo.</span>
              </label>
            ) : null}
            <label className={CAMPO}>
              Enlace del trabajo
              <Input name="enlaceTrabajo" type="url" placeholder="https://" />
            </label>
            <div className="flex items-center gap-2">
              <SubmitButton className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Crear grupo</SubmitButton>
              <Button variant="ghost" asChild><Link href={cerrarEn} scroll={false}>Cancelar</Link></Button>
            </div>
          </form>
        </PanelLateral>
      ) : null}
    </PaginaCompleta>
  );
}
