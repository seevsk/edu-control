import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { listarReunionesGrupo } from "@/server/services/reunion";
import {
  DIAS_CORTOS,
  diaSemanaISO,
  etiquetaFechaLarga,
  etiquetaMinutos,
  fechaEnZonaLimaISO,
  minutosDelDiaLima,
} from "@/lib/calendario";
import { Avatar } from "@/components/avatar";
import { IconAgregar } from "@/components/icons";
import { Toast } from "@/components/toast";
import { TabsGrupo } from "../_components/tabs-grupo";
import { cancelarReunionAction, responderReunionAction } from "./actions";

type Reuniones = Awaited<ReturnType<typeof listarReunionesGrupo>>;
type ReunionListada = Reuniones["proximas"][number];

function horario(reunion: { inicio: Date; fin: Date }) {
  return `${etiquetaMinutos(minutosDelDiaLima(reunion.inicio))} – ${etiquetaMinutos(minutosDelDiaLima(reunion.fin))}`;
}

export default async function ReunionesGrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; toast?: string }>;
}) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  const { error, toast } = await searchParams;
  let grupo;
  try {
    ({ grupo } = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo));
  } catch {
    notFound();
  }

  const { proximas, pasadas, rolActual } = await listarReunionesGrupo(sesion.idUsuario, idGrupo);
  const participa = rolActual !== "observador";
  const puedeProgramar = participa && grupo.estado === "activo";

  return (
    <div className="animate-page-in mx-auto flex max-w-3xl flex-col gap-6">
      <Toast mensaje={toast} />
      <div>
        <Link href="/grupos" className="text-sm text-primary hover:underline">
          Grupos
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{grupo.nombre}</h1>
      </div>
      <TabsGrupo idGrupo={idGrupo} activa="reuniones" />

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Próximas</h2>
          {puedeProgramar ? (
            <Link
              href={`/grupos/${idGrupo}/reuniones/nueva`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover"
            >
              <IconAgregar className="size-4" aria-hidden />
              Programar reunión
            </Link>
          ) : null}
        </div>

        {proximas.length === 0 ? (
          <p className="rounded-md border border-border bg-surface px-4 py-5 text-sm text-text-muted">
            Sin reuniones próximas.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
            {proximas.map((reunion) => (
              <FilaReunion
                key={reunion.idReunion}
                reunion={reunion}
                idGrupo={idGrupo}
                idUsuario={sesion.idUsuario}
                participa={participa}
                puedeCancelar={participa && (reunion.creador.idUsuario === sesion.idUsuario || rolActual === "lider")}
              />
            ))}
          </ul>
        )}
      </section>

      {pasadas.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-text-muted">Anteriores</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
            {pasadas.map((reunion) => {
              const fechaISO = fechaEnZonaLimaISO(reunion.inicio);
              return (
                <li key={reunion.idReunion} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
                  <span className="font-medium text-text-muted">{reunion.titulo}</span>
                  <span className="tabular-nums text-xs text-text-muted">
                    {etiquetaFechaLarga(fechaISO)} · {horario(reunion)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FilaReunion({
  reunion,
  idGrupo,
  idUsuario,
  participa,
  puedeCancelar,
}: {
  reunion: ReunionListada;
  idGrupo: number;
  idUsuario: number;
  participa: boolean;
  puedeCancelar: boolean;
}) {
  const fechaISO = fechaEnZonaLimaISO(reunion.inicio);
  const mia = reunion.asistentes.find((a) => a.idUsuario === idUsuario)?.respuesta ?? "pendiente";
  const asistiran = reunion.asistentes.filter((a) => a.respuesta === "asistire");
  const noAsistiran = reunion.asistentes.filter((a) => a.respuesta === "no_asistire").length;
  const sinResponder = reunion.asistentes.filter((a) => a.respuesta === "pendiente").length;
  const responder = responderReunionAction.bind(null, idGrupo, reunion.idReunion);

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
      <div className="grid w-14 shrink-0 place-items-center rounded-md border border-border py-1.5 text-center">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
          {DIAS_CORTOS[diaSemanaISO(fechaISO) - 1]}
        </span>
        <span className="text-lg font-semibold leading-tight tabular-nums">{Number(fechaISO.slice(8))}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold">{reunion.titulo}</p>
        <p className="mt-0.5 text-sm text-text-muted">
          <span className="tabular-nums">{etiquetaFechaLarga(fechaISO)} · {horario(reunion)}</span>
          {reunion.lugar ? <> · {reunion.lugar}</> : null}
        </p>
        {reunion.enlace ? (
          <a
            href={reunion.enlace}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-block text-sm text-primary hover:underline"
          >
            Abrir enlace
          </a>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-text-muted">
          {asistiran.length > 0 ? (
            <span className="flex -space-x-1.5">
              {asistiran.map((a) => (
                <span key={a.idUsuario} className="rounded-full ring-2 ring-surface" title={a.usuario.nombre}>
                  <Avatar nombre={a.usuario.nombre} apellidos={a.usuario.apellidos} fotoUrl={a.usuario.fotoUrl} tamano="sm" />
                </span>
              ))}
            </span>
          ) : null}
          <span className="tabular-nums">
            {[
              `${asistiran.length} ${asistiran.length === 1 ? "asistirá" : "asistirán"}`,
              noAsistiran > 0 ? `${noAsistiran} no` : null,
              sinResponder > 0 ? `${sinResponder} sin responder` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      </div>

      {participa ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <div className="flex overflow-hidden rounded-md border border-border-strong text-sm" role="group" aria-label="Tu asistencia">
            {(
              [
                { valor: "asistire", texto: "Asistiré", activa: "bg-estado-completada/15 font-medium text-estado-completada" },
                { valor: "no_asistire", texto: "No asistiré", activa: "bg-danger/10 font-medium text-danger" },
              ] as const
            ).map((opcion, i) => (
              <form key={opcion.valor} action={responder}>
                <input type="hidden" name="respuesta" value={opcion.valor} />
                <button
                  type="submit"
                  aria-pressed={mia === opcion.valor}
                  className={`px-3 py-1.5 transition-colors duration-150 ${i > 0 ? "border-l border-border-strong" : ""} ${
                    mia === opcion.valor ? opcion.activa : "bg-surface hover:bg-bg"
                  }`}
                >
                  {opcion.texto}
                </button>
              </form>
            ))}
          </div>
          {puedeCancelar ? (
            <form action={cancelarReunionAction.bind(null, idGrupo, reunion.idReunion)}>
              <button type="submit" className="rounded-sm px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10">
                Cancelar reunión
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
