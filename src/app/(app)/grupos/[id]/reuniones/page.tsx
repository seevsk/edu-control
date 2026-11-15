import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { listarMisReuniones } from "@/server/services/reunion";
import { horaLima } from "@/lib/dates";
import { diaMesCorto, fechaEnZonaLimaISO } from "@/lib/calendario";
import { aOracion } from "@/lib/presentacion";
import { Button } from "@/components/ui/button";
import { MarcoGrupo } from "../_components/marco-grupo";

type Reunion = Awaited<ReturnType<typeof listarMisReuniones>>["proximas"][number];

function FilaReunion({ reunion, idGrupo, pasada = false }: { reunion: Reunion; idGrupo: number; pasada?: boolean }) {
  const asistiran = reunion.asistentes.filter((asistente) => asistente.respuesta === "asistire").length;
  const pendientes = reunion.asistentes.filter((asistente) => asistente.respuesta === "pendiente").length;
  return (
    <li>
      <Link
        href={`/reuniones?grupo=${idGrupo}#reunion-${reunion.idReunion}`}
        className="flex min-h-[52px] items-center gap-4 border-b border-border-subtle px-4 py-2 text-[13px] hover:bg-muted sm:px-6"
      >
        <span className="w-24 shrink-0 text-xs leading-5 text-subtle-foreground tabular-nums">
          {diaMesCorto(fechaEnZonaLimaISO(reunion.inicio))}
          <br />
          {horaLima(reunion.inicio)}
        </span>
        <span className="h-8 w-[3px] shrink-0 rounded-full bg-cat-reunion" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={pasada ? "block truncate text-muted-foreground" : "block truncate"}>{aOracion(reunion.titulo)}</span>
          <span className="block truncate text-xs text-subtle-foreground">
            {reunion.lugar ?? (reunion.enlace ? "Virtual" : "Sin lugar definido")} · hasta {horaLima(reunion.fin)}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {asistiran} de {reunion.asistentes.length} asistirán{!pasada && pendientes ? ` · ${pendientes} sin responder` : ""}
        </span>
      </Link>
    </li>
  );
}

export default async function ReunionesGrupoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  const datos = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!datos) notFound();
  const { proximas, pasadas } = await listarMisReuniones(sesion.idUsuario);
  const delGrupoProximas = proximas.filter((reunion) => reunion.idGrupo === idGrupo);
  const delGrupoPasadas = pasadas.filter((reunion) => reunion.idGrupo === idGrupo);
  const puedeProgramar = datos.rolActual !== "observador" && datos.grupo.estado === "activo";

  return (
    <MarcoGrupo
      datos={datos}
      idUsuario={sesion.idUsuario}
      activa="reuniones"
      accionPrincipal={
        puedeProgramar ? (
          <Button size="sm" asChild>
            <Link href={`/reuniones/nueva?grupo=${idGrupo}`}>
              <CalendarPlus aria-hidden />
              Programar reunión
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="-mx-4 -my-5 sm:-mx-6">
        <h2 className="flex h-9 items-center gap-2 border-b bg-muted px-4 text-[13px] font-medium sm:px-6">
          Próximas <span className="font-normal text-subtle-foreground">{delGrupoProximas.length}</span>
        </h2>
        {delGrupoProximas.length ? (
          <ul>{delGrupoProximas.map((reunion) => <FilaReunion key={reunion.idReunion} reunion={reunion} idGrupo={idGrupo} />)}</ul>
        ) : (
          <p className="border-b px-4 py-4 text-[13px] text-subtle-foreground sm:px-6">
            Las reuniones que programe el grupo aparecerán aquí, con quién confirmó asistencia.
            {puedeProgramar ? " La pestaña Horarios sugiere huecos en los que todos están libres." : ""}
          </p>
        )}
        {delGrupoPasadas.length ? (
          <>
            <h2 className="flex h-9 items-center gap-2 border-b bg-muted px-4 text-[13px] font-medium sm:px-6">
              Pasadas <span className="font-normal text-subtle-foreground">{delGrupoPasadas.length}</span>
            </h2>
            <ul>{delGrupoPasadas.map((reunion) => <FilaReunion key={reunion.idReunion} reunion={reunion} idGrupo={idGrupo} pasada />)}</ul>
          </>
        ) : null}
      </div>
    </MarcoGrupo>
  );
}
