import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, CheckCircle2, Clock, ExternalLink, LogOut, MapPin, Users, XCircle } from "lucide-react";
import { fechaCompleta, fechaCorta, hora, marcaActividad } from "@/lib/formato-fecha";
import { aOracion } from "@/lib/presentacion";
import { nombreCorto } from "@/lib/nombres";
import { ETIQUETA_ESTADO_EVALUACION, type EstadoEvaluacion } from "@/lib/estado-evaluacion";
import { CourseDot } from "@/components/ui-app/course-dot";
import { StatusIcon } from "@/components/ui-app/status-icon";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { responderInvitacionAction } from "../../grupos/actions";
import { ConfirmarAceptacion } from "./confirmar-aceptacion";

type Persona = { idUsuario: number; nombre: string; apellidos: string | null; fotoUrl?: string | null };

/** Fecha corta visible y la completa al pasar el cursor o para lectores de pantalla. */
export function Fecha({ fecha, ahora, conHora = true }: { fecha: Date; ahora: Date; conHora?: boolean }) {
  return (
    <time dateTime={fecha.toISOString()} title={fechaCompleta(fecha)}>
      {fechaCorta(fecha, { ahora, conHora })}
    </time>
  );
}

/** Fila etiqueta-valor del panel derecho. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-subtle-foreground">{etiqueta}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-[13px]">{children}</dd>
    </div>
  );
}

export function PersonaEnLinea({ persona, idUsuarioActual }: { persona: Persona | null; idUsuarioActual: number }) {
  if (!persona) return <span className="text-subtle-foreground">Alguien</span>;
  const nombre = persona.idUsuario === idUsuarioActual ? "Tú" : nombreCorto(persona.nombre, persona.apellidos);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <UserAvatar usuario={persona} tamano="xs" />
      {persona.idUsuario === idUsuarioActual ? (
        <span className="truncate">{nombre}</span>
      ) : (
        <Link href={`/usuarios/${persona.idUsuario}`} className="truncate hover:underline">{nombre}</Link>
      )}
    </span>
  );
}

/** Tarjeta "qué pasó": quién, cuándo y, si hay, el motivo citado. */
export function QuePaso({
  persona,
  accion,
  fecha,
  ahora,
  motivo,
  idUsuarioActual,
}: {
  persona: Persona | null;
  accion: string;
  fecha: Date;
  ahora: Date;
  motivo?: string | null;
  idUsuarioActual: number;
}) {
  return (
    <div className="flex gap-3 rounded-lg border bg-card px-4 py-3.5">
      <UserAvatar usuario={persona} tamano="lg" />
      <div className="min-w-0 flex-1 text-sm">
        <p>
          <span className="font-medium">{persona ? (persona.idUsuario === idUsuarioActual ? "Tú" : nombreCorto(persona.nombre, persona.apellidos)) : "Alguien"}</span>{" "}
          {accion}
        </p>
        <p className="mt-0.5 text-xs text-subtle-foreground"><Fecha fecha={fecha} ahora={ahora} /></p>
        {motivo ? <blockquote className="mt-2.5 rounded-lg border bg-muted px-3 py-2 text-[13px] text-muted-foreground">“{motivo}”</blockquote> : null}
      </div>
    </div>
  );
}

export function Cabecera({ icono, titulo, contexto, accion }: { icono?: ReactNode; titulo: string; contexto?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-[240px] flex-1">
        <div className="flex items-center gap-2.5">
          {icono}
          <h2 className="text-xl font-semibold tracking-[-0.01em]">{titulo}</h2>
        </div>
        {contexto ? <div className="mt-1.5 flex items-center gap-2 text-[13px] text-muted-foreground">{contexto}</div> : null}
      </div>
      {accion}
    </div>
  );
}

const ESTADO_INVITACION = {
  pendiente: { Icono: Clock, color: "text-hoy", texto: "Por responder" },
  aceptada: { Icono: CheckCircle2, color: "text-estado-completada", texto: "Aceptada" },
  rechazada: { Icono: XCircle, color: "text-subtle-foreground", texto: "Rechazada" },
  retirado: { Icono: LogOut, color: "text-destructive", texto: "Fuera del grupo" },
  cancelada: { Icono: XCircle, color: "text-subtle-foreground", texto: "Cancelada" },
} as const;

export interface InvitacionDetalle {
  estadoInvitacion: keyof typeof ESTADO_INVITACION;
  retiroVoluntario: boolean;
  fechaInvitacion: Date;
  fechaRespuesta: Date | null;
  fechaRetiro: Date | null;
  invitador: Persona;
  lider: Persona | null;
  cantidadIntegrantes: number;
  integrantes: Persona[];
  grupo: {
    idGrupo: number;
    nombre: string;
    estado: "activo" | "finalizado";
    descripcion: string | null;
    fechaLimite: Date | null;
    evaluacion: { nombre: string; curso: { idCurso: number; nombre: string } } | null;
  };
}

export function DetalleInvitacion({ invitacion, idUsuario, ahora }: { invitacion: InvitacionDetalle; idUsuario: number; ahora: Date }) {
  const { grupo } = invitacion;
  const estado = ESTADO_INVITACION[invitacion.estadoInvitacion];
  const curso = grupo.evaluacion?.curso ?? null;
  const pendiente = invitacion.estadoInvitacion === "pendiente";
  const respuesta =
    invitacion.estadoInvitacion === "retirado"
      ? { texto: invitacion.retiroVoluntario ? "Saliste del grupo" : "El líder te retiró", fecha: invitacion.fechaRetiro }
      : invitacion.estadoInvitacion === "aceptada"
        ? { texto: "Aceptaste", fecha: invitacion.fechaRespuesta }
        : invitacion.estadoInvitacion === "rechazada"
          ? { texto: "Rechazaste", fecha: invitacion.fechaRespuesta }
          : null;

  return (
    <div className="flex flex-col gap-6">
      <Cabecera
        titulo={aOracion(grupo.nombre)}
        contexto={curso ? <><CourseDot idCurso={curso.idCurso} />{aOracion(curso.nombre)}{grupo.evaluacion ? ` · ${grupo.evaluacion.nombre}` : ""}</> : "Grupo sin curso asociado"}
        accion={invitacion.estadoInvitacion === "aceptada" ? <Button size="sm" asChild><Link href={`/grupos/${grupo.idGrupo}`}>Abrir grupo</Link></Button> : null}
      />

      <QuePaso persona={invitacion.invitador} accion={`te invitó a ${aOracion(grupo.nombre)}`} fecha={invitacion.fechaInvitacion} ahora={ahora} idUsuarioActual={idUsuario} />

      <dl className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-4 border-y py-4">
        <Dato etiqueta="Estado">
          <estado.Icono className={cn("size-3.5", estado.color)} aria-hidden />
          {estado.texto}
        </Dato>
        {respuesta?.fecha ? <Dato etiqueta={respuesta.texto}><Fecha fecha={respuesta.fecha} ahora={ahora} /></Dato> : null}
        <Dato etiqueta="Líder"><PersonaEnLinea persona={invitacion.lider} idUsuarioActual={idUsuario} /></Dato>
        <Dato etiqueta="Integrantes">
          <Users className="size-3.5 text-subtle-foreground" aria-hidden />
          {invitacion.cantidadIntegrantes === 1 ? "1 persona" : `${invitacion.cantidadIntegrantes} personas`}
        </Dato>
        <Dato etiqueta="Fecha límite del grupo">{grupo.fechaLimite ? <Fecha fecha={grupo.fechaLimite} ahora={ahora} conHora={false} /> : "Sin fecha"}</Dato>
        {grupo.estado === "finalizado" ? <Dato etiqueta="Grupo">Finalizado</Dato> : null}
      </dl>

      {grupo.descripcion ? <p className="text-sm leading-relaxed text-muted-foreground">{grupo.descripcion}</p> : null}

      {invitacion.integrantes.length ? (
        <section>
          <h3 className="mb-2.5 text-[13px] font-medium text-muted-foreground">Integrantes</h3>
          <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
            {invitacion.integrantes.map((persona) => (
              <li key={persona.idUsuario} className="text-[13px]"><PersonaEnLinea persona={persona} idUsuarioActual={idUsuario} /></li>
            ))}
          </ul>
        </section>
      ) : null}

      {pendiente ? (
        grupo.estado === "finalizado" ? (
          <p className="text-[13px] text-subtle-foreground">El grupo ya finalizó: no se puede aceptar.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <ConfirmarAceptacion
              nombreGrupo={grupo.nombre}
              action={responderInvitacionAction.bind(null, grupo.idGrupo, "aceptada")}
              claseBoton="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            />
            <form action={responderInvitacionAction.bind(null, grupo.idGrupo, "rechazada")}>
              <Button type="submit" variant="outline">Rechazar</Button>
            </form>
          </div>
        )
      ) : null}
    </div>
  );
}

const RESPUESTA_REUNION = {
  asistire: { texto: "Asistirá", clase: "text-estado-completada" },
  no_asistire: { texto: "No asistirá", clase: "text-subtle-foreground" },
  pendiente: { texto: "Sin responder", clase: "text-hoy" },
} as const;

export interface ReunionDetalle {
  idReunion: number;
  idGrupo: number;
  titulo: string;
  inicio: Date;
  fin: Date;
  lugar: string | null;
  enlace: string | null;
  fechaCreacion: Date;
  creador: Persona;
  asistentes: { respuesta: keyof typeof RESPUESTA_REUNION; usuario: Persona }[];
}

export function DetalleReunion({ reunion, grupo, idUsuario, ahora, terminada = false }: { reunion: ReunionDetalle; grupo: ReactNode; idUsuario: number; ahora: Date; terminada?: boolean }) {
  const propia = reunion.asistentes.find((asistente) => asistente.usuario.idUsuario === idUsuario);
  const confirmados = reunion.asistentes.filter((asistente) => asistente.respuesta === "asistire").length;
  return (
    <div className="flex flex-col gap-6">
      <Cabecera
        icono={<CalendarDays className="size-5 text-cat-reunion" aria-hidden />}
        titulo={reunion.titulo}
        contexto={grupo}
        accion={<Button size="sm" asChild><Link href={`/reuniones/${reunion.idReunion}`}>{propia?.respuesta === "pendiente" && !terminada ? "Confirmar asistencia" : "Ver detalle"}</Link></Button>}
      />
      <QuePaso persona={reunion.creador} accion="programó una reunión" fecha={reunion.fechaCreacion} ahora={ahora} idUsuarioActual={idUsuario} />
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-4 border-y py-4">
        <Dato etiqueta="Cuándo"><Fecha fecha={reunion.inicio} ahora={ahora} conHora={false} /></Dato>
        <Dato etiqueta="Horario">{hora(reunion.inicio)} - {hora(reunion.fin)}</Dato>
        {reunion.lugar ? <Dato etiqueta="Lugar"><MapPin className="size-3.5 text-subtle-foreground" aria-hidden />{reunion.lugar}</Dato> : null}
        {reunion.enlace ? (
          <Dato etiqueta="Enlace">
            <a href={reunion.enlace} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate underline underline-offset-2">
              Unirse <ExternalLink className="size-3" aria-hidden />
            </a>
          </Dato>
        ) : null}
        <Dato etiqueta="Tu respuesta"><span className={RESPUESTA_REUNION[propia?.respuesta ?? "pendiente"].clase}>{RESPUESTA_REUNION[propia?.respuesta ?? "pendiente"].texto}</span></Dato>
      </dl>
      <section>
        <h3 className="mb-2.5 text-[13px] font-medium text-muted-foreground">Asistentes · {confirmados} de {reunion.asistentes.length} confirmaron</h3>
        <ul className="flex flex-col">
          {reunion.asistentes.map((asistente) => (
            <li key={asistente.usuario.idUsuario} className="flex h-9 items-center justify-between gap-3 border-b border-border-subtle text-[13px] last:border-0">
              <PersonaEnLinea persona={asistente.usuario} idUsuarioActual={idUsuario} />
              <span className={cn("text-xs", RESPUESTA_REUNION[asistente.respuesta].clase)}>{RESPUESTA_REUNION[asistente.respuesta].texto}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export interface InvitadoPorMi {
  usuario: Persona;
  estadoInvitacion: keyof typeof ESTADO_INVITACION;
  fechaInvitacion: Date;
  fechaRespuesta: Date | null;
}

/** Para quien invitó: la respuesta concreta y el estado de todas las invitaciones que envió en ese grupo. */
export function DetalleRespuestaInvitacion({
  persona,
  aceptada,
  fecha,
  grupo,
  idGrupo,
  invitados,
  idUsuario,
  ahora,
}: {
  persona: Persona | null;
  aceptada: boolean;
  fecha: Date;
  grupo: ReactNode;
  idGrupo: number;
  invitados: InvitadoPorMi[];
  idUsuario: number;
  ahora: Date;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Cabecera
        icono={aceptada ? <CheckCircle2 className="size-5 text-estado-completada" aria-hidden /> : <XCircle className="size-5 text-subtle-foreground" aria-hidden />}
        titulo={aceptada ? "Aceptaron tu invitación" : "Rechazaron tu invitación"}
        contexto={grupo}
        accion={<Button size="sm" variant="outline" asChild><Link href={`/grupos/${idGrupo}/integrantes`}>Ver integrantes</Link></Button>}
      />
      <QuePaso persona={persona} accion={aceptada ? "aceptó tu invitación y ya es parte del grupo" : "rechazó tu invitación"} fecha={fecha} ahora={ahora} idUsuarioActual={idUsuario} />
      {invitados.length ? (
        <section>
          <h3 className="mb-2.5 text-[13px] font-medium text-muted-foreground">Invitaciones que enviaste en este grupo</h3>
          <ul>
            {invitados.map((invitado) => {
              const estado = ESTADO_INVITACION[invitado.estadoInvitacion];
              return (
                <li key={invitado.usuario.idUsuario} className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle py-1.5 text-[13px] last:border-0">
                  <span className="min-w-0 flex-1"><PersonaEnLinea persona={invitado.usuario} idUsuarioActual={idUsuario} /></span>
                  <span className={cn("inline-flex items-center gap-1 text-xs", estado.color)}><estado.Icono className="size-3.5" aria-hidden />{estado.texto}</span>
                  <span className="w-28 text-right text-xs text-subtle-foreground">{marcaActividad(invitado.fechaRespuesta ?? invitado.fechaInvitacion, ahora)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function DetalleEvaluacionAviso({
  evaluacion,
  ahora,
}: {
  evaluacion: { idEvaluacion: number; nombre: string; estado: EstadoEvaluacion; fechaCierre: Date; fechaApertura: Date | null; requiereEntrega: boolean; fechaEntrega: Date | null; fechaCreacion: Date; curso: { idCurso: number; nombre: string } };
  ahora: Date;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Cabecera
        icono={<StatusIcon estado={evaluacion.estado} className="size-5" />}
        titulo={evaluacion.nombre}
        contexto={<><CourseDot idCurso={evaluacion.curso.idCurso} />{aOracion(evaluacion.curso.nombre)}</>}
        accion={<Button size="sm" asChild><Link href={`/cursos/${evaluacion.curso.idCurso}?evaluacion=${evaluacion.idEvaluacion}`}>Abrir evaluación</Link></Button>}
      />
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-4 border-y py-4">
        <Dato etiqueta="Estado"><StatusIcon estado={evaluacion.estado} />{ETIQUETA_ESTADO_EVALUACION[evaluacion.estado]}</Dato>
        <Dato etiqueta="Cierra"><Fecha fecha={evaluacion.fechaCierre} ahora={ahora} /></Dato>
        {evaluacion.fechaApertura ? <Dato etiqueta="Abre"><Fecha fecha={evaluacion.fechaApertura} ahora={ahora} conHora={false} /></Dato> : null}
        <Dato etiqueta="Entrega">{!evaluacion.requiereEntrega ? "Sin entrega (examen o exposición)" : evaluacion.fechaEntrega ? <span className="text-estado-completada">Entregada</span> : <span className="text-hoy">Por entregar</span>}</Dato>
        <Dato etiqueta="Registrada"><Fecha fecha={evaluacion.fechaCreacion} ahora={ahora} /></Dato>
      </dl>
    </div>
  );
}
