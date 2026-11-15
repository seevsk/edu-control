import Link from "next/link";
import { ArrowLeft, Bell, CalendarDays, CheckCheck, Mail } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { obtenerBandeja } from "@/server/services/notificacion";
import { obtenerTareaDelGrupo } from "@/server/services/tarea";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { fechaCorta, marcaActividad, partesLima } from "@/lib/formato-fecha";
import { aOracion } from "@/lib/presentacion";
import { nombreCorto } from "@/lib/nombres";
import { describirCambioTarea, leerValorEstadoHistorial } from "@/lib/tarea-historial";
import { PaginaCompleta } from "@/components/ui-app/page-header";
import { Migas } from "@/components/ui-app/barra-superior";
import { CourseDot } from "@/components/ui-app/course-dot";
import { StatusIcon } from "@/components/ui-app/status-icon";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { marcarTodasLeidasAction } from "./actions";
import { MarcarLeido } from "./_components/marcar-leido";
import { responderInvitacionAction } from "../grupos/actions";
import { ConfirmarAceptacion } from "../invitaciones/confirmar-aceptacion";

type Filtro = "todo" | "sin-leer" | "invitaciones";
const DIA_MS = 86_400_000;

/** Hoy / Esta semana (lunes a domingo, en Lima) / Anteriores. */
function periodo(fecha: Date, ahora: Date): "Hoy" | "Esta semana" | "Anteriores" {
  const p = partesLima(fecha);
  const hoy = partesLima(ahora);
  const dia = (x: typeof p) => Date.UTC(x.anio, x.mes - 1, x.dia) / DIA_MS;
  if (dia(p) === dia(hoy)) return "Hoy";
  return dia(hoy) - dia(p) < hoy.diaSemana ? "Esta semana" : "Anteriores";
}

function IconoTipo({ tipo }: { tipo: string }) {
  const Icono = tipo.startsWith("invitacion") ? Mail : tipo === "reunion_programada" ? CalendarDays : Bell;
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
      <Icono className="size-3.5" aria-hidden />
    </span>
  );
}

export default async function BandejaPage({ searchParams }: { searchParams: Promise<{ filtro?: string; sel?: string }> }) {
  const sesion = await requerirSesion();
  const consulta = await searchParams;
  const filtro: Filtro = consulta.filtro === "sin-leer" || consulta.filtro === "invitaciones" ? consulta.filtro : "todo";
  const ahora = new Date();
  const { elementos, invitacionesPendientes } = await obtenerBandeja(sesion.idUsuario);
  const sinLeer = elementos.filter((elemento) => !elemento.leida).length;

  const visibles = filtro === "sin-leer" ? elementos.filter((elemento) => !elemento.leida) : filtro === "invitaciones" ? [] : elementos;
  const seleccionado = elementos.find((elemento) => elemento.clave === consulta.sel) ?? null;
  const href = (cambios: Record<string, string | undefined>) => {
    const destino = new URLSearchParams();
    const base = { filtro: filtro === "todo" ? undefined : filtro, sel: consulta.sel, ...cambios };
    for (const [clave, valor] of Object.entries(base)) if (valor) destino.set(clave, valor);
    const texto = destino.toString();
    return `/notificaciones${texto ? `?${texto}` : ""}`;
  };

  const tarea = seleccionado?.idGrupo && seleccionado.idTarea
    ? await obtenerTareaDelGrupo(sesion.idUsuario, seleccionado.idGrupo, seleccionado.idTarea).catch(() => null)
    : null;
  const grupoTarea = tarea && seleccionado?.idGrupo ? await obtenerGrupoDelUsuario(sesion.idUsuario, seleccionado.idGrupo).catch(() => null) : null;
  const nombres = new Map(grupoTarea?.grupo.integrantes.map((integrante) => [integrante.idUsuario, nombreCorto(integrante.usuario.nombre, integrante.usuario.apellidos)]) ?? []);
  const nombreActor = (idUsuario: number, nombre: string, apellidos: string | null) => (idUsuario === sesion.idUsuario ? "Tú" : nombreCorto(nombre, apellidos));

  const grupos: { titulo: string; items: typeof visibles }[] = [];
  for (const elemento of visibles) {
    const titulo = periodo(elemento.fecha, ahora);
    const ultimo = grupos.at(-1);
    if (ultimo?.titulo === titulo) ultimo.items.push(elemento);
    else grupos.push({ titulo, items: [elemento] });
  }

  const pestanas: { valor: Filtro; texto: string }[] = [
    { valor: "todo", texto: "Todo" },
    { valor: "sin-leer", texto: `Sin leer · ${sinLeer}` },
    { valor: "invitaciones", texto: `Invitaciones · ${invitacionesPendientes.length}` },
  ];

  return (
    <PaginaCompleta className="sm:min-h-[calc(100%+3rem)]">
      <Migas items={[{ texto: "Bandeja" }]} />
      <div className="flex min-h-0 flex-1 flex-wrap">
        <section aria-label="Notificaciones" className={cn("flex-[1_1_380px] pb-4 md:max-w-[460px] md:border-r", seleccionado && "max-md:hidden")}>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <h1 className="flex-1 text-lg font-semibold">Bandeja</h1>
            {sinLeer ? (
              <form action={marcarTodasLeidasAction}>
                <Button type="submit" variant="ghost" size="icon" className="size-8" aria-label="Marcar todo como leído" title="Marcar todo como leído">
                  <CheckCheck aria-hidden />
                </Button>
              </form>
            ) : null}
          </div>
          <div className="px-4 pb-2">
            <div role="group" aria-label="Filtro" className="inline-flex gap-0.5 rounded-[7px] bg-secondary p-0.5">
              {pestanas.map((pestana) => (
                <Link
                  key={pestana.valor}
                  href={href({ filtro: pestana.valor === "todo" ? undefined : pestana.valor, sel: undefined })}
                  aria-current={filtro === pestana.valor ? "true" : undefined}
                  className={cn("flex h-7 items-center rounded-[5px] px-3 text-[13px]", filtro === pestana.valor ? "bg-background text-foreground shadow-xs dark:bg-accent" : "text-muted-foreground hover:text-foreground")}
                >
                  {pestana.texto}
                </Link>
              ))}
            </div>
          </div>

          {filtro === "invitaciones" || (filtro === "todo" && invitacionesPendientes.length) ? (
            <>
              <p className="px-4 pt-3.5 pb-1.5 text-xs font-medium text-muted-foreground">Invitaciones por responder</p>
              {invitacionesPendientes.length ? invitacionesPendientes.map((invitacion) => (
                <div key={invitacion.idGrupo} className="mx-1.5 flex items-start gap-2.5 rounded-md px-2.5 py-2.5">
                  <span className="flex h-7 items-center"><span className="size-1.5 rounded-full bg-foreground" aria-label="Sin responder" /></span>
                  <IconoTipo tipo="invitacion_grupo" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[13px] font-medium">Te invitaron a {aOracion(invitacion.nombre)}</span>
                    {invitacion.curso ? <span className="flex items-center gap-1.5 truncate text-xs text-subtle-foreground"><CourseDot idCurso={invitacion.curso.idCurso} />{aOracion(invitacion.curso.nombre)}</span> : null}
                    {invitacion.finalizado ? (
                      <span className="text-xs text-subtle-foreground">El grupo ya finalizó</span>
                    ) : (
                      <span className="mt-1 flex gap-1.5">
                        <ConfirmarAceptacion nombreGrupo={invitacion.nombre} action={responderInvitacionAction.bind(null, invitacion.idGrupo, "aceptada")} />
                        <form action={responderInvitacionAction.bind(null, invitacion.idGrupo, "rechazada")}>
                          <Button type="submit" variant="outline" size="sm" className="h-7">Rechazar</Button>
                        </form>
                      </span>
                    )}
                  </span>
                  <span className="text-xs leading-5 text-subtle-foreground">{marcaActividad(invitacion.fecha, ahora)}</span>
                </div>
              )) : <p className="px-4 py-3 text-[13px] text-subtle-foreground">Cuando alguien te invite a su grupo, podrás aceptar o rechazar aquí mismo.</p>}
            </>
          ) : null}

          {filtro !== "invitaciones" ? (
            grupos.length ? grupos.map((grupo) => (
              <div key={grupo.titulo}>
                <p className="px-4 pt-3.5 pb-1.5 text-xs font-medium text-muted-foreground">{grupo.titulo}</p>
                {grupo.items.map((elemento) => (
                  <Link
                    key={elemento.clave}
                    href={href({ sel: elemento.clave })}
                    scroll={false}
                    className={cn("mx-1.5 flex items-start gap-2.5 rounded-md px-2.5 py-2.5 hover:bg-muted", seleccionado?.clave === elemento.clave && "bg-secondary hover:bg-secondary")}
                  >
                    <span className="flex h-7 items-center"><span className={cn("size-1.5 rounded-full", elemento.leida ? "bg-transparent" : "bg-foreground")} aria-label={elemento.leida ? undefined : "Sin leer"} /></span>
                    <IconoTipo tipo={elemento.tipo} />
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className={cn("truncate text-[13px]", !elemento.leida && "font-medium")}>
                        {elemento.mensaje.replace(/\.$/, "")}
                        {elemento.cantidad > 1 ? <span className="font-normal text-subtle-foreground"> · {elemento.cantidad} novedades</span> : null}
                      </span>
                      {elemento.grupo ? (
                        <span className="flex items-center gap-1.5 truncate text-xs text-subtle-foreground">
                          {elemento.grupo.curso ? <CourseDot idCurso={elemento.grupo.curso.idCurso} className="size-[7px]" /> : null}
                          <span className="truncate">{aOracion(elemento.grupo.nombre)}{elemento.grupo.curso ? ` · ${aOracion(elemento.grupo.curso.nombre)}` : ""}</span>
                        </span>
                      ) : null}
                    </span>
                    <time dateTime={elemento.fecha.toISOString()} className="text-xs leading-5 whitespace-nowrap text-subtle-foreground">{marcaActividad(elemento.fecha, ahora)}</time>
                  </Link>
                ))}
              </div>
            )) : (
              <p className="px-4 py-6 text-[13px] text-subtle-foreground">
                {filtro === "sin-leer" ? "Estás al día: no tienes novedades sin leer." : "Aquí llegarán las tareas que te asignen, las revisiones, las reuniones y las invitaciones de tus grupos."}
              </p>
            )
          ) : null}
        </section>

        <section aria-label="Detalle" className={cn("min-w-0 flex-[999_1_420px]", !seleccionado && "max-md:hidden")}>
          {seleccionado ? (
            <div className="flex max-w-[720px] flex-col gap-6 px-4 py-6 sm:px-8">
              <MarcarLeido ids={seleccionado.leida ? [] : seleccionado.ids} />
              <Link href={href({ sel: undefined })} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground md:hidden"><ArrowLeft className="size-3.5" aria-hidden />Bandeja</Link>
              {tarea ? (
                <>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[260px] flex-1">
                      <div className="flex items-center gap-2.5"><StatusIcon estado={tarea.estado} /><h2 className="text-xl font-semibold">{tarea.titulo}</h2></div>
                      {seleccionado.grupo ? (
                        <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
                          {seleccionado.grupo.curso ? <CourseDot idCurso={seleccionado.grupo.curso.idCurso} /> : null}
                          {aOracion(seleccionado.grupo.nombre)}{seleccionado.grupo.curso ? ` · ${aOracion(seleccionado.grupo.curso.nombre)}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <Button size="sm" asChild><Link href={`/grupos/${seleccionado.idGrupo}?tarea=${tarea.idTarea}`}>Abrir tarea</Link></Button>
                  </div>
                  <div className="flex flex-wrap gap-7 border-y py-3.5 text-[13px]">
                    <div><p className="mb-1 text-xs text-subtle-foreground">Estado</p><StatusIcon estado={tarea.estado} conTexto /></div>
                    <div>
                      <p className="mb-1 text-xs text-subtle-foreground">Asignada a</p>
                      <span className="flex items-center gap-1.5">
                        <UserAvatar usuario={tarea.asignado && tarea.idAsignado ? { idUsuario: tarea.idAsignado, ...tarea.asignado } : null} tamano="xs" />
                        {tarea.asignado && tarea.idAsignado ? nombreActor(tarea.idAsignado, tarea.asignado.nombre, tarea.asignado.apellidos) : "Sin asignar"}
                      </span>
                    </div>
                    {tarea.fechaLimite ? <div><p className="mb-1 text-xs text-subtle-foreground">Vence</p>{fechaCorta(tarea.fechaLimite, { ahora, conHora: true })}</div> : null}
                  </div>
                  <div>
                    <h3 className="mb-3.5 text-[13px] font-medium text-muted-foreground">Actividad</h3>
                    <ol>
                      {tarea.historial.filter((entrada) => entrada.accion !== "vista").slice(0, 12).map((entrada, indice, lista) => {
                        const motivo = entrada.accion === "estado" ? leerValorEstadoHistorial(entrada.valorNuevo).motivo : null;
                        return (
                          <li key={entrada.idHistorial} className="relative flex gap-3 pb-5">
                            {indice < lista.length - 1 ? <span className="absolute top-[30px] bottom-0 left-[13px] w-px bg-border" aria-hidden /> : null}
                            <UserAvatar usuario={{ idUsuario: entrada.idUsuario, nombre: entrada.usuario.nombre, apellidos: entrada.usuario.apellidos }} tamano="lg" className="size-7" />
                            <div className="min-w-0 flex-1 pt-1 text-sm">
                              <span className="font-medium">{nombreActor(entrada.idUsuario, entrada.usuario.nombre, entrada.usuario.apellidos)}</span>{" "}
                              {describirCambioTarea({ ...entrada, valorNuevo: motivo ? leerValorEstadoHistorial(entrada.valorNuevo).estado : entrada.valorNuevo }, nombres).replace(/^./, (letra) => letra.toLowerCase())}
                              <time dateTime={entrada.fecha.toISOString()} className="ml-1.5 text-xs text-subtle-foreground">{marcaActividad(entrada.fecha, ahora)}</time>
                              {motivo ? <blockquote className="mt-2 rounded-lg border bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">“{motivo}”</blockquote> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <IconoTipo tipo={seleccionado.tipo} />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold">{seleccionado.mensaje.replace(/\.$/, "")}</h2>
                      <p className="mt-1 text-[13px] text-subtle-foreground">{fechaCorta(seleccionado.fecha, { ahora, conHora: true })}</p>
                    </div>
                  </div>
                  {seleccionado.enlace ? <Button size="sm" className="w-fit" asChild><Link href={seleccionado.enlace}>Abrir</Link></Button> : null}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-60 items-center justify-center px-6 text-center text-[13px] text-subtle-foreground">
              Elige una notificación para ver su detalle y lo que pasó con esa tarea.
            </div>
          )}
        </section>
      </div>
    </PaginaCompleta>
  );
}
