import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Monitor, MoreHorizontal, Pencil, Plus, Repeat, Users } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import {
  obtenerCursoDelUsuario,
  obtenerEvaluacionDelUsuario,
  cambiosPendientesDeCursoImportado,
  describirCambiosPendientes,
  gruposVinculadosPorCurso,
} from "@/server/services/curso";
import { listarMisGrupos } from "@/server/services/grupo";
import { DIAS_SEMANA } from "@/lib/dates";
import { distancia, duracionMinutos, fechaCorta, rangoHoras } from "@/lib/formato-fecha";
import { aOracion, avisoGruposDesvinculados } from "@/lib/presentacion";
import { formatoTitulo, nombreCorto } from "@/lib/nombres";
import {
  actualizarCursoAction,
  actualizarHorarioCursoAction,
  agregarEvaluacionAction,
  agregarHorarioAction,
  alternarActivoCursoAction,
  eliminarCursoAction,
  eliminarEvaluacionAction,
  marcarEvaluacionEntregadaAction,
  sincronizarCursoAction,
} from "../actions";
import { PaginaCompleta, VolverMovil } from "@/components/ui-app/page-header";
import { Migas } from "@/components/ui-app/barra-superior";
import { PanelLateral } from "@/components/ui-app/panel-lateral";
import { DialogoUrl } from "@/components/ui-app/dialogo-url";
import { CourseDot } from "@/components/ui-app/course-dot";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { CampoToggle } from "@/components/ui-app/campo-toggle";
import { SubmitButton } from "@/components/submit-button";
import { BotonConfirmacion } from "@/components/boton-confirmacion";
import { SelectorHorarioSemanal } from "@/components/selector-horario-semanal";
import { Toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormEvaluacion } from "./_components/form-evaluacion";
import { DetalleEvaluacion } from "./_components/detalle-evaluacion";
import { StatusIcon } from "@/components/ui-app/status-icon";
import { ETIQUETA_ESTADO_EVALUACION, evaluacionAbierta } from "@/lib/estado-evaluacion";

// "Origen" (creado por ti / importado) queda oculto por ahora (pedido del usuario, 2026-11-16).
const MOSTRAR_ORIGEN = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sesion = await requerirSesion();
  const curso = Number.isInteger(Number(id)) ? await obtenerCursoDelUsuario(sesion.idUsuario, Number(id)).catch(() => null) : null;
  if (!curso) notFound();
  return { title: aOracion(curso.nombre) };
}

const CAMPO = "flex flex-col gap-1.5 text-[13px] font-medium";
const DIAS_CURSO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MODALIDAD = { presencial: "Presencial", remoto: "Remoto" } as const;

function horas(time: Date) {
  return { horas: time.getUTCHours(), minutos: time.getUTCMinutes() };
}

function valorTime(time: Date) {
  return `${String(time.getUTCHours()).padStart(2, "0")}:${String(time.getUTCMinutes()).padStart(2, "0")}`;
}

export default async function CursoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; toast?: string; editar?: string; nuevaEvaluacion?: string; sesion?: string; horario?: string; nuevo?: string; evaluacion?: string }>;
}) {
  const { id } = await params;
  const idCurso = Number(id);
  if (!Number.isInteger(idCurso)) notFound();
  const sesion = await requerirSesion();
  const consulta = await searchParams;

  const curso = await obtenerCursoDelUsuario(sesion.idUsuario, idCurso).catch(() => null);
  if (!curso) notFound();
  const idEvaluacionAbierta = Number(consulta.evaluacion);
  const [cambiosPendientes, grupos, vinculados, evaluacionAbiertaDetalle] = await Promise.all([
    curso.importadoDeIdCurso ? cambiosPendientesDeCursoImportado(idCurso) : Promise.resolve(null),
    listarMisGrupos(sesion.idUsuario),
    gruposVinculadosPorCurso(sesion.idUsuario),
    Number.isInteger(idEvaluacionAbierta) && curso.evaluaciones.some((evaluacion) => evaluacion.idEvaluacion === idEvaluacionAbierta)
      ? obtenerEvaluacionDelUsuario(sesion.idUsuario, idEvaluacionAbierta).catch(() => null)
      : Promise.resolve(null),
  ]);

  const ahora = new Date();
  const ruta = `/cursos/${idCurso}`;
  const nombre = aOracion(curso.nombre);
  const docente = curso.docente ? formatoTitulo(curso.docente) : null;
  const modalidad = curso.modalidad ? MODALIDAD[curso.modalidad] : null;
  const importado = curso.importadoDeIdCurso !== null;
  const dueno = curso.importadoDe ? nombreCorto(curso.importadoDe.usuario.nombre, curso.importadoDe.usuario.apellidos) : null;
  const diasConClase = new Set(curso.horarios.map((horario) => horario.diaSemana));
  const primera = curso.horarios[0];
  const resumenHorario = primera
    ? `${DIAS_SEMANA.find((dia) => dia.valor === primera.diaSemana)?.nombre} ${rangoHoras(horas(primera.horaInicio), horas(primera.horaFin))}${curso.horarios.length > 1 ? ` +${curso.horarios.length - 1}` : ""}`
    : null;
  // Próximas = abiertas que no cierran; el resto (terminadas, descartadas o ya cerradas) va abajo.
  const proximas = curso.evaluaciones.filter((evaluacion) => evaluacionAbierta(evaluacion.estado) && evaluacion.fechaCierre >= ahora);
  const cerradas = curso.evaluaciones.filter((evaluacion) => !proximas.includes(evaluacion)).reverse();
  const idsRelacionados = new Set([curso.idCurso, curso.importadoDeIdCurso].filter((valor): valor is number => valor !== null));
  const gruposDelCurso = grupos.filter((grupo) => grupo.estado === "activo" && grupo.evaluacion && idsRelacionados.has(grupo.evaluacion.curso.idCurso));
  const sesionEditada = curso.horarios.find((horario) => String(horario.idHorario) === consulta.sesion);
  const error = consulta.error;

  function FilaEvaluacion({ evaluacion }: { evaluacion: NonNullable<typeof curso>["evaluaciones"][number] }) {
    const entrega = !evaluacion.requiereEntrega
      ? { texto: "Sin entrega", clase: "text-subtle-foreground" }
      : evaluacion.fechaEntrega
        ? { texto: "Entregada", clase: "text-estado-completada" }
        : { texto: "Por entregar", clase: "text-hoy" };
    const vencida = evaluacionAbierta(evaluacion.estado) && evaluacion.fechaCierre < ahora;
    return (
      <li className="relative flex min-h-[52px] items-center gap-3 border-b border-border-subtle px-2 text-sm hover:bg-muted">
        <StatusIcon estado={evaluacion.estado} />
        <Link
          href={`${ruta}?evaluacion=${evaluacion.idEvaluacion}`}
          scroll={false}
          className="min-w-0 flex-1 truncate after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
        >
          <span className={evaluacion.estado === "descartada" ? "text-subtle-foreground line-through" : undefined}>{evaluacion.nombre}</span>
          <span className="sr-only"> · {ETIQUETA_ESTADO_EVALUACION[evaluacion.estado]}</span>
          {vencida ? <span className="ml-2 text-xs text-destructive">Vencida</span> : null}
        </Link>
        <span className="hidden w-[190px] flex-col sm:flex">
          <time dateTime={evaluacion.fechaCierre.toISOString()}>{fechaCorta(evaluacion.fechaCierre, { ahora, conHora: true })}</time>
          <span className="text-xs text-subtle-foreground">{evaluacion.requiereEntrega ? distancia(evaluacion.fechaCierre, ahora) : "examen o exposición"}</span>
        </span>
        <span className="w-[100px]">
          <span className={`rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${entrega.clase}`}>{entrega.texto}</span>
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative z-10 size-8" aria-label={`Acciones de ${evaluacion.nombre}`}><MoreHorizontal aria-hidden /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {evaluacion.requiereEntrega && !evaluacion.fechaEntrega ? (
              <form action={marcarEvaluacionEntregadaAction.bind(null, idCurso, evaluacion.idEvaluacion, true)}>
                <DropdownMenuItem asChild><button type="submit" className="w-full">Marcar entregada</button></DropdownMenuItem>
              </form>
            ) : null}
            <form action={eliminarEvaluacionAction.bind(null, idCurso, evaluacion.idEvaluacion)}>
              <BotonConfirmacion mensaje={`¿Quitar la evaluación ${evaluacion.nombre}?${avisoGruposDesvinculados(vinculados.porEvaluacion.get(evaluacion.idEvaluacion) ?? 0, "evaluación")}`} className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10">
                Quitar
              </BotonConfirmacion>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  }

  return (
    <PaginaCompleta>
      <Migas items={[{ href: "/cursos", texto: "Cursos" }, { texto: nombre }]} />
      <Toast mensaje={consulta.toast} />
      <div className="mx-auto w-full max-w-[1080px] px-4 pt-1 pb-7 sm:px-8 md:pt-7">
        {/* Móvil: en el celular se llega a los cursos desde "Tú". */}
        <VolverMovil href="/tu" texto="Tú" />
        <header className="flex flex-wrap items-start gap-4 border-b pb-5">
          <div className="min-w-[280px] flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <CourseDot idCurso={idCurso} className="size-3" />
              <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{nombre}</h1>
              <span className={`rounded-full border px-2 py-0.5 text-xs ${curso.activo ? "border-estado-completada/30 text-estado-completada" : "text-subtle-foreground"}`}>
                {curso.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {[curso.codigo, docente, modalidad, resumenHorario].filter(Boolean).join(" · ") || "Sin datos generales"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`${ruta}?editar=1`} scroll={false}><Pencil aria-hidden />Editar curso</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-8" aria-label="Más acciones del curso"><MoreHorizontal aria-hidden /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <form action={alternarActivoCursoAction.bind(null, idCurso)}>
                  <DropdownMenuItem asChild><button type="submit" className="w-full">{curso.activo ? "Desactivar (terminó el ciclo)" : "Marcar activo"}</button></DropdownMenuItem>
                </form>
                <DropdownMenuSeparator />
                <form action={eliminarCursoAction.bind(null, idCurso)}>
                  <BotonConfirmacion mensaje={`¿Eliminar ${nombre}? También se eliminarán sus horarios y evaluaciones.${avisoGruposDesvinculados(vinculados.porCurso.get(idCurso) ?? 0, "curso")}`} className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10">
                    Eliminar curso
                  </BotonConfirmacion>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {error && !consulta.editar && !consulta.nuevaEvaluacion && !consulta.sesion && !consulta.horario && !evaluacionAbiertaDetalle ? (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>
        ) : null}

        {importado && cambiosPendientes ? (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-input p-3 text-[13px]">
            <span className="flex-1 text-muted-foreground">{dueno ? `${dueno} cambió` : "Cambió"} el horario o las evaluaciones del curso original.</span>
            <form action={sincronizarCursoAction.bind(null, idCurso)}>
              <BotonConfirmacion mensaje={describirCambiosPendientes(cambiosPendientes)} className="h-8 rounded-md border border-input px-3 text-[13px] hover:bg-accent">Traer actualizaciones</BotonConfirmacion>
            </form>
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap items-start gap-10">
          <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-9">
            <section>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Horario semanal</h2>
                <span className="inline-flex items-center gap-1.5 text-xs text-subtle-foreground"><Repeat className="size-3.5" aria-hidden />Se repite cada semana del ciclo</span>
              </div>
              <div className="mb-3.5 flex gap-1.5" aria-hidden>
                {DIAS_CURSO.map((dia, indice) => (
                  <div key={dia} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className={`text-xs ${diasConClase.has(indice + 1) ? "text-foreground" : "text-subtle-foreground"}`}>{dia}</span>
                    <span className="h-1.5 w-full rounded-[3px]" style={{ backgroundColor: diasConClase.has(indice + 1) ? `var(--curso-${((idCurso % 8) + 8) % 8})` : "var(--secondary)" }} />
                  </div>
                ))}
              </div>
              {curso.horarios.length ? (
                <ul className="border-t border-border-subtle">
                  {curso.horarios.map((horario) => {
                    const minutos = (horario.horaFin.getTime() - horario.horaInicio.getTime()) / 60_000;
                    return (
                      <li key={horario.idHorario} className="flex min-h-12 flex-wrap items-center gap-3.5 border-b border-border-subtle px-2 py-2 text-sm hover:bg-muted">
                        <span className="w-11 font-medium">{DIAS_CURSO[horario.diaSemana - 1]}</span>
                        <span className="min-w-0 flex-1">
                          {rangoHoras(horas(horario.horaInicio), horas(horario.horaFin))}
                          <span className="ml-2 text-subtle-foreground max-md:mt-0.5 max-md:ml-0 max-md:block max-md:text-[13px]">{duracionMinutos(minutos)}<span className="md:hidden"> · cada semana</span></span>
                        </span>
                        {modalidad ? <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground max-md:hidden">{curso.modalidad === "remoto" ? <Monitor className="size-3.5" aria-hidden /> : <Users className="size-3.5" aria-hidden />}{modalidad}</span> : null}
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`${ruta}?sesion=${horario.idHorario}`} scroll={false}>Editar sesión</Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-input p-4 text-sm">
                  <p className="flex-1 text-muted-foreground">Este curso todavía no tiene horario. Configúralo una vez para verlo en tu calendario.</p>
                  <Link href={`${ruta}?horario=1`} scroll={false} className="text-[13px] underline underline-offset-2">Configurar horario</Link>
                </div>
              )}
            </section>

            <section>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Evaluaciones</h2>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${ruta}?nuevaEvaluacion=1`} scroll={false}><Plus aria-hidden />Agregar evaluación</Link>
                </Button>
              </div>
              {curso.evaluaciones.length === 0 ? (
                <p className="rounded-lg border border-dashed border-input p-4 text-sm text-muted-foreground">
                  Registra las evaluaciones del curso para ver sus cierres en Tu trabajo y en el calendario.
                </p>
              ) : (
                <>
                  {proximas.length ? (
                    <>
                      <p className="px-2 pt-2 pb-1.5 text-xs text-subtle-foreground">Próximas</p>
                      <ul>{proximas.map((evaluacion) => <FilaEvaluacion key={evaluacion.idEvaluacion} evaluacion={evaluacion} />)}</ul>
                    </>
                  ) : null}
                  {cerradas.length ? (
                    <>
                      <p className="px-2 pt-4 pb-1.5 text-xs text-subtle-foreground">Cerradas</p>
                      <ul>{cerradas.map((evaluacion) => <FilaEvaluacion key={evaluacion.idEvaluacion} evaluacion={evaluacion} />)}</ul>
                    </>
                  ) : null}
                </>
              )}
            </section>
          </div>

          <aside className="flex min-w-0 flex-[1_1_260px] flex-col gap-7">
            <section>
              <h2 className="mb-2.5 text-sm font-semibold">Detalles</h2>
              <dl>
                {[
                  ["Código", curso.codigo ?? "—"],
                  ["Docente", docente ?? "Sin registrar"],
                  ["Modalidad", modalidad ?? "Sin especificar"],
                  ["Estado", curso.activo ? "Activo este ciclo" : "Inactivo"],
                  ...(MOSTRAR_ORIGEN ? [["Origen", importado ? `Importado${dueno ? ` de ${dueno}` : ""}` : "Creado por ti"]] : []),
                ].map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="flex flex-col gap-0.5 border-b border-border-subtle py-2.5">
                    <dt className="text-xs text-subtle-foreground">{etiqueta}</dt>
                    <dd className="text-sm">{valor}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section>
              <h2 className="mb-2.5 text-sm font-semibold">Grupos de este curso</h2>
              {gruposDelCurso.length ? (
                <ul>
                  {gruposDelCurso.map((grupo) => (
                    <li key={grupo.idGrupo}>
                      <Link href={`/grupos/${grupo.idGrupo}`} className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-sm hover:bg-muted">
                        <span className="flex-1 truncate">{aOracion(grupo.nombre)}</span>
                        <span className="flex">
                          {grupo.integrantes.filter((integrante) => integrante.estadoInvitacion === "aceptada").slice(0, 3).map((integrante, indice) => (
                            <UserAvatar key={integrante.idUsuario} usuario={integrante.usuario} className={indice ? "-ml-1.5 ring-2 ring-background" : "ring-2 ring-background"} />
                          ))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-subtle-foreground">Los grupos que crees desde una evaluación de este curso aparecerán aquí.</p>
              )}
            </section>
          </aside>
        </div>
      </div>

      {consulta.editar === "1" ? (
        <PanelLateral titulo="Editar curso" cerrarEn={ruta}>
          {error ? <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p> : null}
          <form action={actualizarCursoAction.bind(null, idCurso)} className="flex flex-col gap-4">
            {importado ? (
              <p className="rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
                Nombre, docente y modalidad se sincronizan con el curso de {dueno ?? "su dueño"}; solo él puede cambiarlos.
              </p>
            ) : null}
            <label className={CAMPO}>
              Nombre
              <Input name="nombre" required maxLength={120} defaultValue={curso.nombre} readOnly={importado} className={importado ? "bg-muted text-muted-foreground" : undefined} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={CAMPO}>Código<Input name="codigo" required maxLength={30} defaultValue={curso.codigo ?? ""} /></label>
              <label className={CAMPO}>
                Docente
                <Input name="docente" maxLength={120} defaultValue={curso.docente ?? ""} readOnly={importado} className={importado ? "bg-muted text-muted-foreground" : undefined} />
              </label>
            </div>
            <div className={CAMPO}>
              Modalidad
              {importado ? (
                <>
                  <input type="hidden" name="modalidad" value={curso.modalidad ?? ""} />
                  <span className="text-sm font-normal text-muted-foreground">{modalidad ?? "Sin especificar"}</span>
                </>
              ) : (
                <CampoToggle name="modalidad" etiqueta="Modalidad" defaultValue={curso.modalidad ?? ""} opciones={[{ valor: "presencial", texto: "Presencial" }, { valor: "remoto", texto: "Remoto" }, { valor: "", texto: "Sin especificar" }]} />
              )}
            </div>
            <label className="flex items-center justify-between gap-3 text-[13px] font-medium">
              Activo este ciclo
              <Switch name="activo" defaultChecked={curso.activo} />
            </label>
            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button variant="ghost" asChild><Link href={ruta} scroll={false}>Cancelar</Link></Button>
              <SubmitButton className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Guardar cambios</SubmitButton>
            </div>
          </form>
        </PanelLateral>
      ) : null}

      {consulta.nuevaEvaluacion === "1" ? (
        <DialogoUrl titulo="Agregar evaluación" cerrarEn={ruta}>
          {error ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p> : null}
          <FormEvaluacion action={agregarEvaluacionAction.bind(null, idCurso)} cerrarEn={ruta} />
        </DialogoUrl>
      ) : null}

      {evaluacionAbiertaDetalle ? (
        <PanelLateral titulo={evaluacionAbiertaDetalle.nombre} descripcion={nombre} cerrarEn={ruta}>
          <DetalleEvaluacion idCurso={idCurso} evaluacion={evaluacionAbiertaDetalle} error={error} />
        </PanelLateral>
      ) : null}

      {sesionEditada ? (
        <DialogoUrl titulo={`Editar sesión del ${DIAS_SEMANA.find((dia) => dia.valor === sesionEditada.diaSemana)?.nombre.toLowerCase()}`} cerrarEn={ruta}>
          {error ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p> : null}
          <form action={actualizarHorarioCursoAction.bind(null, idCurso, sesionEditada.idHorario)} className="flex flex-col gap-4">
            <SelectorHorarioSemanal modo="unico" incluirDomingo={false} diasSeleccionados={[sesionEditada.diaSemana]} horaInicio={valorTime(sesionEditada.horaInicio)} horaFin={valorTime(sesionEditada.horaFin)} tituloDias="Día de clase" />
            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button variant="ghost" asChild><Link href={ruta} scroll={false}>Cancelar</Link></Button>
              <SubmitButton className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Guardar sesión</SubmitButton>
            </div>
          </form>
        </DialogoUrl>
      ) : null}

      {consulta.horario === "1" && curso.horarios.length === 0 ? (
        <DialogoUrl titulo="Configurar horario" cerrarEn={ruta}>
          {error ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p> : null}
          <form action={agregarHorarioAction.bind(null, idCurso)} className="flex flex-col gap-4">
            <SelectorHorarioSemanal incluirDomingo={false} diasSeleccionados={[]} horaInicio="09:00" horaFin="11:00" tituloDias="Días de clase" />
            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button variant="ghost" asChild><Link href={ruta} scroll={false}>Cancelar</Link></Button>
              <SubmitButton className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Guardar horario</SubmitButton>
            </div>
          </form>
        </DialogoUrl>
      ) : null}
    </PaginaCompleta>
  );
}
