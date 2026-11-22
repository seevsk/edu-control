import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BookOpen, CalendarDays, CheckCheck, CheckCircle2, ChevronLeft, Clock, LogOut, Mail, Search, UserMinus, Video, XCircle } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { obtenerBandeja, obtenerDetalleInvitacion, obtenerReunionParaBandeja } from "@/server/services/notificacion";
import { obtenerTareaDelGrupo } from "@/server/services/tarea";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { obtenerEvaluacionDelUsuario } from "@/server/services/curso";
import { fechaCorta, marcaActividad, partesLima } from "@/lib/formato-fecha";
import { aOracion } from "@/lib/presentacion";
import { nombreCorto } from "@/lib/nombres";
import { resumirNotificacion } from "@/lib/bandeja";
import { describirCambioTarea, leerValorEstadoHistorial } from "@/lib/tarea-historial";
import { ACCION_MOVIL, ChipsFiltro, PaginaCompleta } from "@/components/ui-app/page-header";
import { responderInvitacionAction } from "../grupos/actions";
import { ConfirmarAceptacion } from "./_components/confirmar-aceptacion";
import { Migas } from "@/components/ui-app/barra-superior";
import { CourseDot } from "@/components/ui-app/course-dot";
import { StatusIcon } from "@/components/ui-app/status-icon";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { marcarTodasLeidasAction } from "./actions";
import { MarcarLeido } from "./_components/marcar-leido";
import {
  Cabecera,
  Dato,
  DetalleEvaluacionAviso,
  DetalleInvitacion,
  DetalleReunion,
  DetalleRespuestaInvitacion,
  Fecha,
  QuePaso,
} from "./_components/detalles";
import { DetalleReunionFinalizada, DetalleReunionIniciada } from "./_components/detalles-reunion-video";

export const metadata: Metadata = { title: "Bandeja" };

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

const ICONOS: Record<string, typeof Bell> = {
  invitacion_grupo: Mail,
  invitacion_respondida: Mail,
  reunion_programada: CalendarDays,
  reunion_iniciada: Video,
  reunion_finalizada: Video,
  integrante_salio: UserMinus,
  evaluacion_creada: BookOpen,
};

function IconoTipo({ tipo }: { tipo: string }) {
  const Icono = ICONOS[tipo] ?? Bell;
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
      <Icono className="size-3.5" aria-hidden />
    </span>
  );
}

const ESTADO_HISTORIAL = {
  aceptada: { Icono: CheckCircle2, color: "text-estado-completada", texto: "Aceptaste" },
  rechazada: { Icono: XCircle, color: "text-subtle-foreground", texto: "Rechazaste" },
  retirado: { Icono: LogOut, color: "text-destructive", texto: "Te retiraron" },
  cancelada: { Icono: XCircle, color: "text-subtle-foreground", texto: "Cancelaron" },
  pendiente: { Icono: Clock, color: "text-hoy", texto: "Por responder" },
} as const;

/** Acción del historial de la tarea que corresponde a cada aviso (para mostrar quién y el motivo). */
const ACCION_DE_AVISO: Record<string, (entrada: { accion: string; valorAnterior: string | null; valorNuevo: string | null }) => boolean> = {
  tarea_asignada: (entrada) => entrada.accion === "reasignada" || entrada.accion === "creada",
  tarea_en_revision: (entrada) => entrada.accion === "estado" && leerValorEstadoHistorial(entrada.valorNuevo).estado === "en_revision",
  tarea_devuelta: (entrada) => entrada.accion === "estado" && entrada.valorAnterior === "en_revision" && leerValorEstadoHistorial(entrada.valorNuevo).estado === "en_progreso",
  tarea_completada: (entrada) => entrada.accion === "estado" && leerValorEstadoHistorial(entrada.valorNuevo).estado === "completada",
  tarea_reabierta: (entrada) => entrada.accion === "estado" && entrada.valorAnterior === "completada",
  tarea_reprogramada: (entrada) => entrada.accion === "fecha_limite",
  tarea_descartada: (entrada) => entrada.accion === "estado" && leerValorEstadoHistorial(entrada.valorNuevo).estado === "descartada",
};

const VERBO_DE_AVISO: Record<string, string> = {
  tarea_asignada: "te asignó esta tarea",
  tarea_en_revision: "la envió a revisión",
  tarea_devuelta: "te la devolvió",
  tarea_completada: "la aprobó y quedó completada",
  tarea_reabierta: "reabrió la tarea",
  tarea_reprogramada: "cambió la fecha límite",
  tarea_descartada: "descartó la tarea",
};

export default async function BandejaPage({ searchParams }: { searchParams: Promise<{ filtro?: string; sel?: string; error?: string }> }) {
  const sesion = await requerirSesion();
  const consulta = await searchParams;
  const filtro: Filtro = consulta.filtro === "sin-leer" || consulta.filtro === "invitaciones" ? consulta.filtro : "todo";
  const ahora = new Date();
  const { elementos, invitacionesPendientes, historialInvitaciones } = await obtenerBandeja(sesion.idUsuario);
  const sinLeer = elementos.filter((elemento) => !elemento.leida).length + invitacionesPendientes.filter((pendiente) => !pendiente.avisoLeido).length;

  const visibles = filtro === "sin-leer" ? elementos.filter((elemento) => !elemento.leida) : filtro === "invitaciones" ? [] : elementos;
  const seleccionado = elementos.find((elemento) => elemento.clave === consulta.sel) ?? null;
  // "inv-12": una invitación propia (pendiente o del historial), con o sin aviso asociado.
  const idInvitacion = consulta.sel?.startsWith("inv-")
    ? Number(consulta.sel.slice(4))
    : seleccionado?.tipo === "invitacion_grupo"
      ? seleccionado.idInvitacion
      : null;
  const haySeleccion = Boolean(seleccionado || idInvitacion);
  const pendienteSeleccionada = invitacionesPendientes.find((pendiente) => pendiente.idGrupo === idInvitacion) ?? null;
  const href = (cambios: Record<string, string | undefined>) => {
    const destino = new URLSearchParams();
    const base = { filtro: filtro === "todo" ? undefined : filtro, sel: consulta.sel, ...cambios };
    for (const [clave, valor] of Object.entries(base)) if (valor) destino.set(clave, valor);
    const texto = destino.toString();
    return `/notificaciones${texto ? `?${texto}` : ""}`;
  };

  // Datos del panel derecho, según el tipo de lo seleccionado. Cada servicio verifica permisos.
  const resumen = seleccionado ? resumirNotificacion(seleccionado.tipo, seleccionado.mensaje) : null;
  const [invitacion, tarea, grupoDelAviso, reunion, evaluacion] = await Promise.all([
    idInvitacion && Number.isInteger(idInvitacion) ? obtenerDetalleInvitacion(sesion.idUsuario, idInvitacion) : null,
    seleccionado?.idGrupo && seleccionado.idTarea ? obtenerTareaDelGrupo(sesion.idUsuario, seleccionado.idGrupo, seleccionado.idTarea).catch(() => null) : null,
    seleccionado?.idGrupo ? obtenerGrupoDelUsuario(sesion.idUsuario, seleccionado.idGrupo).catch(() => null) : null,
    (seleccionado?.tipo === "reunion_programada" || seleccionado?.tipo === "reunion_iniciada" || seleccionado?.tipo === "reunion_finalizada") && seleccionado.idGrupo
      ? obtenerReunionParaBandeja(sesion.idUsuario, seleccionado.idGrupo, seleccionado.idReunion, resumen?.objeto ?? null, seleccionado.fecha)
      : null,
    seleccionado?.tipo === "evaluacion_creada" && seleccionado.idEvaluacion
      ? obtenerEvaluacionDelUsuario(sesion.idUsuario, seleccionado.idEvaluacion).catch(() => null)
      : null,
  ]);
  const integrantesGrupo = grupoDelAviso?.grupo.integrantes ?? [];
  const nombres = new Map(integrantesGrupo.map((integrante) => [integrante.idUsuario, nombreCorto(integrante.usuario.nombre, integrante.usuario.apellidos)]));
  const nombreActor = (idUsuario: number, nombre: string, apellidos: string | null) => (idUsuario === sesion.idUsuario ? "Tú" : nombreCorto(nombre, apellidos));
  const contextoGrupo = seleccionado?.grupo ? (
    <>
      {seleccionado.grupo.curso ? <CourseDot idCurso={seleccionado.grupo.curso.idCurso} /> : null}
      <Link href={`/grupos/${seleccionado.idGrupo}`} className="hover:underline">{aOracion(seleccionado.grupo.nombre)}</Link>
      {seleccionado.grupo.curso ? ` · ${aOracion(seleccionado.grupo.curso.nombre)}` : ""}
    </>
  ) : null;

  // Quién hizo lo que avisa la notificación: la entrada del historial más cercana a la fecha del aviso.
  const entradaDelAviso = tarea && seleccionado
    ? tarea.historial
        .filter((entrada) => entrada.accion !== "vista" && (ACCION_DE_AVISO[seleccionado.tipo]?.(entrada) ?? true))
        .sort((a, b) => Math.abs(a.fecha.getTime() - seleccionado.fecha.getTime()) - Math.abs(b.fecha.getTime() - seleccionado.fecha.getTime()))[0] ?? null
    : null;

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
  // Móvil: filas a todo el ancho con separador (Claude Design, "Móvil · Bandeja"); desde md, compactas.
  const claseFila = (activa: boolean) =>
    cn(
      "flex items-start gap-3 border-b border-border-subtle px-4 py-3.5 hover:bg-muted md:mx-1.5 md:gap-2.5 md:rounded-md md:border-b-0 md:px-2.5 md:py-2.5",
      activa && "bg-secondary hover:bg-secondary",
    );
  const ETIQUETA_SECCION = "px-4 pt-5 pb-2 text-[13px] font-semibold text-muted-foreground md:pt-3.5 md:pb-1.5 md:text-xs md:font-medium";

  return (
    <PaginaCompleta className="sm:min-h-[calc(100%+3rem)]">
      <Migas items={[{ texto: "Bandeja" }]} />
      <div className="flex min-h-0 flex-1 flex-wrap md:flex-nowrap">
        <section aria-label="Notificaciones" className={cn("min-w-0 flex-[1_1_380px] pb-4 md:w-[320px] md:flex-none md:border-r lg:w-[380px] xl:w-[460px]", haySeleccion && "max-md:hidden")}>
          <div className="flex h-11 items-center justify-end gap-1 px-2 pt-3 md:hidden">
            {sinLeer ? (
              <form action={marcarTodasLeidasAction}>
                <button type="submit" aria-label="Marcar todo como leído" className={ACCION_MOVIL}><CheckCheck aria-hidden /></button>
              </form>
            ) : null}
            <Link href="/usuarios" aria-label="Buscar personas" className={ACCION_MOVIL}><Search aria-hidden /></Link>
          </div>
          <div className="flex items-center gap-2 px-4 pt-1 pb-2 md:pt-4">
            <h1 className="flex-1 text-[30px] leading-tight font-bold tracking-[-0.03em] md:text-lg md:font-semibold md:tracking-normal">Bandeja</h1>
            {sinLeer ? (
              <form action={marcarTodasLeidasAction} className="max-md:hidden">
                <Button type="submit" variant="ghost" size="icon" className="size-8" aria-label="Marcar todo como leído" title="Marcar todo como leído">
                  <CheckCheck aria-hidden />
                </Button>
              </form>
            ) : null}
          </div>
          <ChipsFiltro
            etiqueta="Filtro"
            className="md:hidden"
            opciones={pestanas.map((pestana) => ({
              href: href({ filtro: pestana.valor === "todo" ? undefined : pestana.valor, sel: undefined }),
              texto: pestana.texto,
              activa: filtro === pestana.valor,
            }))}
          />
          <div className="px-4 pb-2 max-md:hidden">
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
              <p className={ETIQUETA_SECCION}>Por responder</p>
              {invitacionesPendientes.length ? invitacionesPendientes.map((pendiente) => (
                <div key={pendiente.idGrupo} className="max-md:border-b max-md:border-border-subtle">
                <Link href={href({ sel: `inv-${pendiente.idGrupo}` })} scroll={false} className={cn(claseFila(idInvitacion === pendiente.idGrupo), "max-md:border-b-0")}>
                  <span className="flex h-7 items-center"><span className="size-1.5 rounded-full bg-foreground" aria-label="Sin responder" /></span>
                  <UserAvatar usuario={pendiente.invitador} tamano="lg" className="size-7" />
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="truncate text-[15px] font-semibold md:text-[13px] md:font-medium">Invitación a {aOracion(pendiente.nombre)}</span>
                    <span className="flex items-center gap-1.5 truncate text-[13px] text-subtle-foreground md:text-xs">
                      {pendiente.curso ? <><CourseDot idCurso={pendiente.curso.idCurso} className="size-[7px]" /><span className="truncate">{aOracion(pendiente.curso.nombre)} ·</span></> : null}
                      <span className="truncate">{nombreCorto(pendiente.invitador.nombre, pendiente.invitador.apellidos)}</span>
                    </span>
                  </span>
                  <time dateTime={pendiente.fecha.toISOString()} className="text-xs leading-5 whitespace-nowrap text-subtle-foreground">{marcaActividad(pendiente.fecha, ahora)}</time>
                </Link>
                {/* Móvil: responder sin abrir el detalle (la aceptación sigue pidiendo el consentimiento). */}
                {pendiente.finalizado ? null : (
                  <div className="-mt-1 flex gap-2 pr-4 pb-3.5 pl-[60px] md:hidden">
                    <ConfirmarAceptacion
                      nombreGrupo={pendiente.nombre}
                      action={responderInvitacionAction.bind(null, pendiente.idGrupo, "aceptada")}
                      claseBoton="flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    />
                    <form action={responderInvitacionAction.bind(null, pendiente.idGrupo, "rechazada")}>
                      <button type="submit" className="flex h-9 items-center rounded-full border border-input px-4 text-sm">Rechazar</button>
                    </form>
                  </div>
                )}
                </div>
              )) : <p className="px-4 py-3 text-[13px] text-subtle-foreground">Nada por responder.</p>}
            </>
          ) : null}

          {filtro === "invitaciones" ? (
            <>
              <p className={cn(ETIQUETA_SECCION, "md:pt-5")}>Historial</p>
              {historialInvitaciones.length ? historialInvitaciones.map((registro) => {
                const estado = registro.estado === "retirado" && registro.voluntario
                  ? { ...ESTADO_HISTORIAL.retirado, texto: "Saliste de" }
                  : ESTADO_HISTORIAL[registro.estado];
                return (
                  <Link key={registro.idGrupo} href={href({ sel: `inv-${registro.idGrupo}` })} scroll={false} className={claseFila(idInvitacion === registro.idGrupo)}>
                    <span className="flex h-7 w-1.5 items-center" aria-hidden />
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary"><estado.Icono className={cn("size-3.5", estado.color)} aria-hidden /></span>
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="truncate text-[15px] md:text-[13px]">{estado.texto} <span className="font-medium">{aOracion(registro.nombre)}</span></span>
                      <span className="flex items-center gap-1.5 truncate text-[13px] text-subtle-foreground md:text-xs">
                        {registro.curso ? <><CourseDot idCurso={registro.curso.idCurso} className="size-[7px]" /><span className="truncate">{aOracion(registro.curso.nombre)}</span></> : null}
                        {registro.invitador ? <span className="truncate">{registro.curso ? "· " : ""}{nombreCorto(registro.invitador.nombre, registro.invitador.apellidos)}</span> : null}
                      </span>
                    </span>
                    <time dateTime={registro.fecha.toISOString()} className="text-xs leading-5 whitespace-nowrap text-subtle-foreground">{marcaActividad(registro.fecha, ahora)}</time>
                  </Link>
                );
              }) : <p className="px-4 py-3 text-[13px] text-subtle-foreground">Las invitaciones que respondas quedarán aquí.</p>}
            </>
          ) : grupos.length ? grupos.map((grupo) => (
            <div key={grupo.titulo}>
              <p className={ETIQUETA_SECCION}>{grupo.titulo}</p>
              {grupo.items.map((elemento) => {
                const corto = resumirNotificacion(elemento.tipo, elemento.mensaje);
                const contexto = [corto.objeto && corto.objeto !== elemento.grupo?.nombre ? corto.objeto : null, elemento.grupo ? aOracion(elemento.grupo.nombre) : null].filter(Boolean).join(" · ");
                return (
                  <Link key={elemento.clave} href={href({ sel: elemento.clave })} scroll={false} className={claseFila(seleccionado?.clave === elemento.clave)}>
                    <span className="flex h-7 items-center"><span className={cn("size-1.5 rounded-full", elemento.leida ? "bg-transparent" : "bg-foreground")} aria-label={elemento.leida ? undefined : "Sin leer"} /></span>
                    <IconoTipo tipo={elemento.tipo} />
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className={cn("truncate text-[15px] md:text-[13px]", !elemento.leida && "font-semibold md:font-medium")}>
                        {corto.titulo}
                        {elemento.cantidad > 1 ? <span className="font-normal text-subtle-foreground"> · {elemento.cantidad} novedades</span> : null}
                      </span>
                      {contexto ? (
                        <span className="flex items-center gap-1.5 truncate text-[13px] text-subtle-foreground md:text-xs">
                          {elemento.grupo?.curso ? <CourseDot idCurso={elemento.grupo.curso.idCurso} className="size-[7px]" /> : null}
                          <span className="truncate">{contexto}</span>
                        </span>
                      ) : null}
                    </span>
                    <time dateTime={elemento.fecha.toISOString()} className="text-xs leading-5 whitespace-nowrap text-subtle-foreground">{marcaActividad(elemento.fecha, ahora)}</time>
                  </Link>
                );
              })}
            </div>
          )) : (
            <p className="px-4 py-6 text-[13px] text-subtle-foreground">
              {filtro === "sin-leer" ? "Estás al día." : "Aquí llegarán tus tareas, revisiones, reuniones e invitaciones."}
            </p>
          )}
        </section>

        <section aria-label="Detalle" className={cn("min-w-0 flex-[999_1_420px] md:flex-1", !haySeleccion && "max-md:hidden")}>
          {haySeleccion ? (
            <div className="flex max-w-[720px] flex-col gap-6 px-4 py-6 sm:px-8">
              {seleccionado ? <MarcarLeido ids={seleccionado.leida ? [] : seleccionado.ids} /> : null}
              {pendienteSeleccionada && !pendienteSeleccionada.avisoLeido ? <MarcarLeido ids={pendienteSeleccionada.idsAviso} /> : null}
              <Link href={href({ sel: undefined })} className="-my-2 -ml-2 inline-flex h-11 w-fit items-center gap-0.5 pr-2 text-[15px] text-muted-foreground md:hidden"><ChevronLeft className="size-6" aria-hidden />Bandeja</Link>
              {consulta.error ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{consulta.error}</p> : null}

              {invitacion ? (
                <DetalleInvitacion invitacion={invitacion} idUsuario={sesion.idUsuario} ahora={ahora} />
              ) : tarea && seleccionado ? (
                <>
                  <Cabecera
                    icono={<StatusIcon estado={tarea.estado} />}
                    titulo={tarea.titulo}
                    contexto={contextoGrupo}
                    accion={<Button size="sm" asChild><Link href={`/grupos/${seleccionado.idGrupo}?tarea=${tarea.idTarea}`}>Abrir tarea</Link></Button>}
                  />
                  {entradaDelAviso ? (
                    <QuePaso
                      persona={{ idUsuario: entradaDelAviso.idUsuario, nombre: entradaDelAviso.usuario.nombre, apellidos: entradaDelAviso.usuario.apellidos }}
                      accion={VERBO_DE_AVISO[seleccionado.tipo] ?? "actualizó la tarea"}
                      fecha={entradaDelAviso.fecha}
                      ahora={ahora}
                      motivo={entradaDelAviso.accion === "estado" ? leerValorEstadoHistorial(entradaDelAviso.valorNuevo).motivo : null}
                      idUsuarioActual={sesion.idUsuario}
                    />
                  ) : null}
                  <dl className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-6 gap-y-4 border-y py-4">
                    <Dato etiqueta="Estado"><StatusIcon estado={tarea.estado} conTexto /></Dato>
                    <Dato etiqueta="Asignada a">
                      <UserAvatar usuario={tarea.asignado && tarea.idAsignado ? { idUsuario: tarea.idAsignado, ...tarea.asignado } : null} tamano="xs" />
                      {tarea.asignado && tarea.idAsignado ? nombreActor(tarea.idAsignado, tarea.asignado.nombre, tarea.asignado.apellidos) : "Sin asignar"}
                    </Dato>
                    {tarea.fechaLimite ? <Dato etiqueta="Vence"><Fecha fecha={tarea.fechaLimite} ahora={ahora} /></Dato> : null}
                    <Dato etiqueta="Peso">{tarea.peso}</Dato>
                  </dl>
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
              ) : reunion && seleccionado?.tipo === "reunion_iniciada" ? (
                <DetalleReunionIniciada reunion={reunion} grupo={contextoGrupo} idUsuario={sesion.idUsuario} ahora={ahora} puedeUnirse={reunion.videollamada && grupoDelAviso?.rolActual !== "observador"} />
              ) : reunion && seleccionado?.tipo === "reunion_finalizada" ? (
                <DetalleReunionFinalizada reunion={reunion} grupo={contextoGrupo} idUsuario={sesion.idUsuario} puedeUnirse={reunion.videollamada && grupoDelAviso?.rolActual !== "observador"} />
              ) : reunion && seleccionado ? (
                <DetalleReunion reunion={reunion} grupo={contextoGrupo} idUsuario={sesion.idUsuario} ahora={ahora} />
              ) : evaluacion ? (
                <DetalleEvaluacionAviso evaluacion={evaluacion} ahora={ahora} />
              ) : seleccionado?.tipo === "invitacion_respondida" && grupoDelAviso ? (
                (() => {
                  const enviadas = integrantesGrupo.filter((integrante) => integrante.idInvitador === sesion.idUsuario || (integrante.idInvitador === null && grupoDelAviso.grupo.idCreador === sesion.idUsuario && integrante.idUsuario !== sesion.idUsuario));
                  const respondidas = enviadas.filter((integrante) => integrante.fechaRespuesta);
                  // La persona que respondió: por nombre si el aviso lo trae; si no, la respuesta más cercana al aviso.
                  const quien = respondidas.find((integrante) => resumen?.persona && nombreCorto(integrante.usuario.nombre, integrante.usuario.apellidos) === resumen.persona)
                    ?? [...respondidas].sort((a, b) => Math.abs(a.fechaRespuesta!.getTime() - seleccionado.fecha.getTime()) - Math.abs(b.fechaRespuesta!.getTime() - seleccionado.fecha.getTime()))[0];
                  return (
                    <DetalleRespuestaInvitacion
                      persona={quien ? quien.usuario : null}
                      aceptada={resumen?.titulo === "Aceptaron tu invitación"}
                      fecha={quien?.fechaRespuesta ?? seleccionado.fecha}
                      grupo={contextoGrupo}
                      idGrupo={grupoDelAviso.grupo.idGrupo}
                      invitados={enviadas.map((integrante) => ({ usuario: integrante.usuario, estadoInvitacion: integrante.estadoInvitacion, fechaInvitacion: integrante.fechaInvitacion, fechaRespuesta: integrante.fechaRespuesta }))}
                      idUsuario={sesion.idUsuario}
                      ahora={ahora}
                    />
                  );
                })()
              ) : seleccionado?.tipo === "integrante_salio" && grupoDelAviso ? (
                (() => {
                  const salidas = integrantesGrupo.filter((integrante) => integrante.retiroVoluntario && integrante.fechaRetiro);
                  const quien = salidas.sort((a, b) => Math.abs(a.fechaRetiro!.getTime() - seleccionado.fecha.getTime()) - Math.abs(b.fechaRetiro!.getTime() - seleccionado.fecha.getTime()))[0];
                  const ahoraLider = resumen?.titulo === "Ahora eres líder";
                  return (
                    <div className="flex flex-col gap-6">
                      <Cabecera
                        icono={<UserMinus className="size-5 text-muted-foreground" aria-hidden />}
                        titulo={ahoraLider ? "Ahora eres líder del grupo" : `${resumen?.persona ?? "Un integrante"} salió del grupo`}
                        contexto={contextoGrupo}
                        accion={<Button size="sm" variant="outline" asChild><Link href={`/grupos/${grupoDelAviso.grupo.idGrupo}/integrantes`}>Ver integrantes</Link></Button>}
                      />
                      <QuePaso
                        persona={quien ? quien.usuario : null}
                        accion={ahoraLider ? "salió del grupo y te dejó como líder" : "salió del grupo por su cuenta"}
                        fecha={quien?.fechaRetiro ?? seleccionado.fecha}
                        ahora={ahora}
                        idUsuarioActual={sesion.idUsuario}
                      />
                      <p className="text-[13px] text-muted-foreground">Sus tareas abiertas quedaron sin asignar: reasígnalas desde el tablero.</p>
                    </div>
                  );
                })()
              ) : seleccionado ? (
                <div className="flex flex-col gap-4">
                  <Cabecera icono={<IconoTipo tipo={seleccionado.tipo} />} titulo={resumen?.titulo ?? "Aviso"} contexto={contextoGrupo} />
                  <p className="text-sm text-muted-foreground">{seleccionado.mensaje}</p>
                  <p className="text-xs text-subtle-foreground">{fechaCorta(seleccionado.fecha, { ahora, conHora: true })}</p>
                  {seleccionado.enlace ? <Button size="sm" className="w-fit" asChild><Link href={seleccionado.enlace}>Abrir</Link></Button> : null}
                </div>
              ) : (
                <p className="text-[13px] text-subtle-foreground">Esta invitación ya no está disponible.</p>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-60 items-center justify-center px-6 text-center text-[13px] text-subtle-foreground">
              Elige un aviso para ver qué pasó, quién fue y cuándo.
            </div>
          )}
        </section>
      </div>
    </PaginaCompleta>
  );
}
