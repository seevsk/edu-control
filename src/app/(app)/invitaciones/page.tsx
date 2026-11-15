import Link from "next/link";
import { CheckCircle2, LogOut, XCircle } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { listarHistorialInvitaciones, listarInvitacionesPendientes } from "@/server/services/grupo";
import { formatearFechaHoraLima } from "@/lib/dates";
import { aOracion } from "@/lib/presentacion";
import { nombreCorto } from "@/lib/nombres";
import { PaginaCompleta, PageHeader } from "@/components/ui-app/page-header";
import { CourseDot } from "@/components/ui-app/course-dot";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { Button } from "@/components/ui/button";
import { responderInvitacionAction } from "../grupos/actions";
import { ConfirmarAceptacion } from "./confirmar-aceptacion";

type Persona = { idUsuario: number; nombre: string; apellidos: string | null; fotoUrl: string | null } | null;
type GrupoResumen = { nombre: string; evaluacion: { nombre: string; curso: { idCurso: number; nombre: string } } | null };

function Contexto({ grupo, invitador }: { grupo: GrupoResumen; invitador: Persona }) {
  const curso = grupo.evaluacion?.curso ?? null;
  return (
    <span className="flex items-center gap-1.5 truncate text-xs text-subtle-foreground">
      {curso ? <><CourseDot idCurso={curso.idCurso} />{aOracion(curso.nombre)}{grupo.evaluacion ? ` · ${grupo.evaluacion.nombre}` : ""} · </> : null}
      {invitador ? `te invitó ${nombreCorto(invitador.nombre, invitador.apellidos)}` : "invitación"}
    </span>
  );
}

function Seccion({ titulo, cantidad, children }: { titulo: string; cantidad: number; children: React.ReactNode }) {
  return (
    <section aria-label={titulo}>
      <h2 className="flex h-9 items-center gap-2 border-b bg-muted px-4 text-[13px] font-medium sm:px-8">
        {titulo}
        <span className="font-normal text-subtle-foreground">{cantidad}</span>
      </h2>
      {children}
    </section>
  );
}

const RESULTADO = {
  aceptada: { Icono: CheckCircle2, color: "text-estado-completada", texto: "Aceptaste" },
  rechazada: { Icono: XCircle, color: "text-subtle-foreground", texto: "Rechazaste" },
  retirado: { Icono: LogOut, color: "text-destructive", texto: "Te retiraron" },
} as const;

export default async function InvitacionesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sesion = await requerirSesion();
  const { error } = await searchParams;
  const [pendientes, historial] = await Promise.all([
    listarInvitacionesPendientes(sesion.idUsuario),
    listarHistorialInvitaciones(sesion.idUsuario),
  ]);

  return (
    <PaginaCompleta>
      <PageHeader
        titulo="Invitaciones"
        contexto={<span>{pendientes.length ? `${pendientes.length} por responder` : "Nada por responder"} · {historial.length} en tu historial</span>}
      />
      {error ? <p role="alert" className="mx-4 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive sm:mx-8">{error}</p> : null}

      <Seccion titulo="Por responder" cantidad={pendientes.length}>
        {pendientes.length ? (
          <ul>
            {pendientes.map((invitacion) => (
              <li key={invitacion.idIntegrante} className="flex min-h-[60px] flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-2.5 text-[13px] sm:px-8">
                <UserAvatar usuario={invitacion.invitador ?? { idUsuario: invitacion.grupo.creador.idUsuario, nombre: invitacion.grupo.creador.nombre, apellidos: invitacion.grupo.creador.apellidos, fotoUrl: invitacion.grupo.creador.fotoUrl }} tamano="lg" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">{aOracion(invitacion.grupo.nombre)}</span>
                  <Contexto grupo={invitacion.grupo} invitador={invitacion.invitador ?? invitacion.grupo.creador} />
                  <span className="text-xs text-subtle-foreground">Recibida el {formatearFechaHoraLima(invitacion.fechaInvitacion)}</span>
                </span>
                {invitacion.grupo.estado === "finalizado" ? (
                  <span className="text-xs text-subtle-foreground">El grupo ya finalizó</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <form action={responderInvitacionAction.bind(null, invitacion.idGrupo, "rechazada")}>
                      <Button type="submit" variant="ghost" size="sm">Rechazar</Button>
                    </form>
                    <ConfirmarAceptacion nombreGrupo={invitacion.grupo.nombre} action={responderInvitacionAction.bind(null, invitacion.idGrupo, "aceptada")} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-b border-border-subtle px-4 py-4 text-[13px] text-subtle-foreground sm:px-8">
            Cuando un compañero te invite a su grupo, la invitación aparecerá aquí para que la aceptes o la rechaces.
          </p>
        )}
      </Seccion>

      <Seccion titulo="Historial" cantidad={historial.length}>
        {historial.length ? (
          <ul>
            {historial.map((registro) => {
              const estado = registro.estadoInvitacion as keyof typeof RESULTADO;
              const resultado = RESULTADO[estado];
              const fecha = estado === "retirado" ? registro.fechaRetiro : registro.fechaRespuesta;
              const puedeAbrir = estado === "aceptada";
              const contenido = (
                <>
                  <resultado.Icono className={`size-4 shrink-0 ${resultado.color}`} aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate">
                      {resultado.texto} <span className="font-medium">{aOracion(registro.grupo.nombre)}</span>
                      {estado === "aceptada" && registro.grupo.estado === "finalizado" ? <span className="text-subtle-foreground"> · finalizado</span> : null}
                    </span>
                    <Contexto grupo={registro.grupo} invitador={registro.invitador} />
                  </span>
                  <span className="shrink-0 text-xs text-subtle-foreground tabular-nums">
                    {fecha ? formatearFechaHoraLima(fecha) : "sin fecha registrada"}
                  </span>
                </>
              );
              return (
                <li key={registro.idIntegrante}>
                  {puedeAbrir ? (
                    <Link href={`/grupos/${registro.idGrupo}`} className="flex min-h-[52px] items-center gap-3 border-b border-border-subtle px-4 py-2 text-[13px] hover:bg-muted sm:px-8">
                      {contenido}
                    </Link>
                  ) : (
                    <div className="flex min-h-[52px] items-center gap-3 border-b border-border-subtle px-4 py-2 text-[13px] text-muted-foreground sm:px-8">
                      {contenido}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-4 text-[13px] text-subtle-foreground sm:px-8">
            Aquí quedará registro de cada invitación que aceptes o rechaces y de los grupos de los que te retiren, con su fecha y quién te invitó.
          </p>
        )}
      </Seccion>
    </PaginaCompleta>
  );
}
