import type { Metadata } from "next";
import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { listarCursos, listarCursosImportables } from "@/server/services/curso";
import { listarMisGrupos } from "@/server/services/grupo";
import { timeAHora } from "@/lib/dates";
import { DIAS_CORTOS, DIAS_LARGOS, diasHasta } from "@/lib/calendario";
import { aOracion } from "@/lib/presentacion";
import { formatoTitulo } from "@/lib/nombres";
import { crearCursoAction, alternarActivoCursoAction, eliminarCursoAction, importarCursoAction, sincronizarCursoAction } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { CampoSelect } from "@/components/ui-app/campo-select";
import { Toast } from "@/components/toast";
import { BotonConfirmacion } from "@/components/boton-confirmacion";
import { SelectorHorarioSemanal } from "@/components/selector-horario-semanal";
import { PaginaCompleta, PageHeader } from "@/components/ui-app/page-header";
import { PanelLateral } from "@/components/ui-app/panel-lateral";
import { CourseDot } from "@/components/ui-app/course-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TablaCursos, type FilaCurso } from "./_components/tabla-cursos";

export const metadata: Metadata = { title: "Cursos" };

const CAMPO = "flex flex-col gap-1.5 text-[13px] font-medium";

function textoHorario(horarios: { diaSemana: number; horaInicio: Date }[]) {
  if (horarios.length === 0) return "Sin horario";
  const ordenados = [...horarios].sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.getTime() - b.horaInicio.getTime());
  if (ordenados.length === 1) return `${DIAS_LARGOS[ordenados[0].diaSemana - 1]} ${timeAHora(ordenados[0].horaInicio)}`;
  const dias = [...new Set(ordenados.map((horario) => DIAS_CORTOS[horario.diaSemana - 1]))].join(", ");
  return `${dias} · ${timeAHora(ordenados[0].horaInicio)}`;
}

export default async function CursosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; toast?: string; vista?: string; nuevo?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error, toast, vista, nuevo } = await searchParams;
  const verInactivos = vista === "inactivos";
  const ahora = new Date();
  const [cursosActivos, cursosInactivos, importables, grupos] = await Promise.all([
    listarCursos(sesion.idUsuario, true),
    listarCursos(sesion.idUsuario, false),
    listarCursosImportables(sesion.idUsuario),
    listarMisGrupos(sesion.idUsuario),
  ]);
  const cursos = verInactivos ? cursosInactivos : cursosActivos;
  const cerrarEn = verInactivos ? "/cursos?vista=inactivos" : "/cursos";

  const filas: FilaCurso[] = cursos.map((curso) => {
    const proxima = curso.evaluaciones.find((evaluacion) => evaluacion.fechaCierre >= ahora) ?? null;
    const dias = proxima ? diasHasta(proxima.fechaCierre, ahora) : 0;
    const idsRelacionados = new Set([curso.idCurso, curso.importadoDeIdCurso].filter((id): id is number => id !== null));
    const cantidadGrupos = grupos.filter((grupo) => grupo.evaluacion && idsRelacionados.has(grupo.evaluacion.curso.idCurso)).length;
    const nombre = aOracion(curso.nombre);
    return {
      idCurso: curso.idCurso,
      nombre,
      codigo: curso.codigo,
      importado: curso.importadoDeIdCurso !== null,
      docente: curso.docente ? formatoTitulo(curso.docente) : null,
      modalidad: curso.modalidad === "presencial" ? "Presencial" : curso.modalidad === "remoto" ? "Remoto" : "—",
      horario: textoHorario(curso.horarios),
      evaluacion: proxima
        ? { texto: `${proxima.nombre} · ${dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`}`, destacada: true }
        : { texto: "Sin evaluaciones próximas", destacada: false },
      grupos: cantidadGrupos ? `${cantidadGrupos} ${cantidadGrupos === 1 ? "grupo" : "grupos"}` : "—",
      menu: (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label={`Más opciones de ${nombre}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link href={`/cursos/${curso.idCurso}`}>Abrir y editar</Link></DropdownMenuItem>
            <form action={alternarActivoCursoAction.bind(null, curso.idCurso)}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">{curso.activo ? "Marcar inactivo" : "Marcar activo"}</button>
              </DropdownMenuItem>
            </form>
            <DropdownMenuSeparator />
            <form action={eliminarCursoAction.bind(null, curso.idCurso)}>
              <BotonConfirmacion
                mensaje={`¿Eliminar ${nombre}? También se eliminarán sus horarios y evaluaciones.`}
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
              >
                Eliminar
              </BotonConfirmacion>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    };
  });

  return (
    <PaginaCompleta>
      <Toast mensaje={toast} />
      <PageHeader
        titulo="Cursos"
        contexto={<span>{cursosActivos.length} {cursosActivos.length === 1 ? "curso activo" : "cursos activos"}</span>}
        acciones={
          <Button size="sm" asChild>
            <Link href="/cursos?nuevo=1" scroll={false}><Plus aria-hidden />Agregar curso</Link>
          </Button>
        }
        pestanas={[
          { href: "/cursos", texto: "Activos", activa: !verInactivos, contador: cursosActivos.length },
          { href: "/cursos?vista=inactivos", texto: "Inactivos", activa: verInactivos, contador: cursosInactivos.length },
        ]}
      />

      {error && nuevo !== "1" ? <p role="alert" className="mx-4 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive sm:mx-8">{error}</p> : null}

      {!verInactivos && importables.length > 0 ? (
        <section aria-labelledby="cursos-importables" className="border-b">
          <h2 id="cursos-importables" className="flex h-9 items-center gap-2 bg-muted px-4 text-[13px] font-medium sm:px-8">
            Disponibles desde tus grupos <span className="font-normal text-subtle-foreground">{importables.length}</span>
          </h2>
          <ul>
            {importables.map(({ cursoFuente, idGrupo, idCursoLocal, hayActualizaciones }) => (
              <li key={cursoFuente.idCurso} className="flex min-h-11 items-center gap-3 border-t px-4 text-[13px] sm:px-8">
                <CourseDot idCurso={cursoFuente.idCurso} />
                <span className="min-w-0 flex-1 truncate">
                  {aOracion(cursoFuente.nombre)}
                  <span className="ml-2 text-xs text-subtle-foreground">{[cursoFuente.codigo, cursoFuente.docente].filter(Boolean).join(" · ")}</span>
                </span>
                <form action={idCursoLocal && hayActualizaciones ? sincronizarCursoAction.bind(null, idCursoLocal) : importarCursoAction.bind(null, idGrupo, "/cursos")}>
                  <SubmitButton className="h-7 rounded-md border border-input px-2.5 text-[13px] hover:bg-accent" pendingText="Guardando...">
                    {idCursoLocal && hayActualizaciones ? "Traer actualizaciones" : "Importar"}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <TablaCursos
        filas={filas}
        vacio={
          verInactivos ? (
            "Los cursos que marques como inactivos al terminar el ciclo aparecerán aquí."
          ) : (
            <>
              Registra tus cursos con su horario para ver tus clases en el calendario y crear grupos desde sus evaluaciones.{" "}
              <Link href="/cursos?nuevo=1" scroll={false} className="text-foreground underline underline-offset-2">Agregar el primero</Link>
            </>
          )
        }
      />

      {!verInactivos && nuevo === "1" ? (
        <PanelLateral titulo="Agregar curso" cerrarEn={cerrarEn}>
          {error ? <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p> : null}
          <form action={crearCursoAction} className="flex flex-col gap-4">
            <label className={CAMPO}>
              Nombre
              <Input name="nombre" required maxLength={120} placeholder="Desarrollo de aplicaciones web" autoFocus />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={CAMPO}>
                Código
                <Input name="codigo" required maxLength={30} placeholder="3708" />
              </label>
              <label className={CAMPO}>
                Modalidad
                <CampoSelect name="modalidad" opciones={[{ valor: "", texto: "Sin especificar" }, { valor: "presencial", texto: "Presencial" }, { valor: "remoto", texto: "Remoto" }]} />
              </label>
            </div>
            <label className={CAMPO}>
              Docente
              <Input name="docente" maxLength={120} />
            </label>
            <fieldset className="flex flex-col gap-2 border-t pt-4">
              <legend className="text-[13px] font-medium">Horario semanal</legend>
              <SelectorHorarioSemanal incluirDomingo={false} diasSeleccionados={[]} horaInicio="09:00" horaFin="11:00" tituloDias="Días de clase" />
            </fieldset>
            <div className="flex items-center gap-2">
              <SubmitButton className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Guardar curso</SubmitButton>
              <Button variant="ghost" asChild><Link href={cerrarEn} scroll={false}>Cancelar</Link></Button>
            </div>
          </form>
        </PanelLateral>
      ) : null}
    </PaginaCompleta>
  );
}
