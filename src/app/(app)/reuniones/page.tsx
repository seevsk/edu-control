import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { listarMisReuniones } from "@/server/services/reunion";
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
import { cancelarReunionAction, responderReunionAction } from "./actions";

type Listado = Awaited<ReturnType<typeof listarMisReuniones>>;
type Reunion = Listado["proximas"][number];
type Rol = "lider" | "miembro" | "observador";

function horario(reunion: { inicio: Date; fin: Date }) {
  return `${etiquetaMinutos(minutosDelDiaLima(reunion.inicio))} – ${etiquetaMinutos(minutosDelDiaLima(reunion.fin))}`;
}

export default async function ReunionesPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string; error?: string; toast?: string }>;
}) {
  const sesion = await requerirSesion();
  const { grupo, error, toast } = await searchParams;
  const { proximas, pasadas, rolPorGrupo } = await listarMisReuniones(sesion.idUsuario);

  const grupos = new Map<number, string>();
  for (const r of [...proximas, ...pasadas]) grupos.set(r.idGrupo, r.grupo.nombre);
  const filtro = grupo && grupos.has(Number(grupo)) ? Number(grupo) : null;
  const filtrar = (lista: Reunion[]) => (filtro ? lista.filter((r) => r.idGrupo === filtro) : lista);

  return (
    <div className="animate-page-in mx-auto flex max-w-3xl flex-col gap-5">
      <Toast mensaje={toast} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Reuniones</h1>
        <Link
          href={filtro ? `/reuniones/nueva?grupo=${filtro}` : "/reuniones/nueva"}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover"
        >
          <IconAgregar className="size-4" aria-hidden />
          Programar reunión
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {grupos.size > 1 ? (
        <nav aria-label="Filtrar por grupo" className="max-w-full overflow-x-auto">
          <div className="flex w-max divide-x divide-border-strong overflow-hidden rounded-md border border-border-strong bg-surface text-sm">
            {[{ id: null, nombre: "Todos" }, ...[...grupos].map(([id, nombre]) => ({ id, nombre }))].map((opcion) => {
              const activo = opcion.id === filtro;
              return (
                <Link
                  key={opcion.id ?? "todos"}
                  href={opcion.id ? `/reuniones?grupo=${opcion.id}` : "/reuniones"}
                  aria-current={activo ? "page" : undefined}
                  className={`whitespace-nowrap px-3 py-1.5 transition-colors duration-150 ${
                    activo ? "bg-primary-soft font-medium text-primary" : "hover:bg-bg"
                  }`}
                >
                  {opcion.nombre}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Próximas</h2>
        {filtrar(proximas).length === 0 ? (
          <p className="rounded-md border border-border bg-surface px-4 py-5 text-sm text-text-muted">Sin reuniones próximas.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
            {filtrar(proximas).map((reunion) => (
              <FilaReunion
                key={reunion.idReunion}
                reunion={reunion}
                idUsuario={sesion.idUsuario}
                rol={rolPorGrupo.get(reunion.idGrupo) ?? "observador"}
              />
            ))}
          </ul>
        )}
      </section>

      {filtrar(pasadas).length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-text-muted">Anteriores</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
            {filtrar(pasadas).map((reunion) => (
              <li key={reunion.idReunion} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
                <span className="text-text-muted">
                  <span className="font-medium">{reunion.titulo}</span> · {reunion.grupo.nombre}
                </span>
                <span className="text-xs tabular-nums text-text-muted">
                  {etiquetaFechaLarga(fechaEnZonaLimaISO(reunion.inicio))} · {horario(reunion)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FilaReunion({ reunion, idUsuario, rol }: { reunion: Reunion; idUsuario: number; rol: Rol }) {
  const fechaISO = fechaEnZonaLimaISO(reunion.inicio);
  const participa = rol !== "observador";
  const puedeCancelar = participa && (reunion.creador.idUsuario === idUsuario || rol === "lider");
  const mia = reunion.asistentes.find((a) => a.idUsuario === idUsuario)?.respuesta ?? "pendiente";
  const asistiran = reunion.asistentes.filter((a) => a.respuesta === "asistire");
  const noAsistiran = reunion.asistentes.filter((a) => a.respuesta === "no_asistire").length;
  const sinResponder = reunion.asistentes.filter((a) => a.respuesta === "pendiente").length;
  const responder = responderReunionAction.bind(null, reunion.idReunion);

  return (
    <li id={`reunion-${reunion.idReunion}`} className="flex scroll-mt-4 flex-col gap-3 px-4 py-4 target:bg-primary-soft/40 sm:flex-row sm:items-start">
      <div className="grid w-14 shrink-0 place-items-center rounded-md border border-border py-1.5 text-center">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
          {DIAS_CORTOS[diaSemanaISO(fechaISO) - 1]}
        </span>
        <span className="text-lg font-semibold leading-tight tabular-nums">{Number(fechaISO.slice(8))}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold">{reunion.titulo}</p>
        <p className="mt-0.5 text-sm text-text-muted">
          <Link href={`/grupos/${reunion.idGrupo}/horarios`} className="hover:text-primary hover:underline">
            {reunion.grupo.nombre}
          </Link>
        </p>
        <p className="mt-0.5 text-sm text-text-muted">
          <span className="tabular-nums">
            {etiquetaFechaLarga(fechaISO)} · {horario(reunion)}
          </span>
          {reunion.lugar ? <> · {reunion.lugar}</> : null}
        </p>
        {reunion.enlace ? (
          <a href={reunion.enlace} target="_blank" rel="noreferrer noopener" className="mt-1 inline-block text-sm text-primary hover:underline">
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
            <form action={cancelarReunionAction.bind(null, reunion.idReunion)}>
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
