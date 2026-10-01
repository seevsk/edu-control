import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { listarTareasDelGrupo } from "@/server/services/tarea";
import { formatearFechaLima } from "@/lib/dates";
import { ESTADOS_TAREA_ORDEN, ETIQUETA_ESTADO_TAREA, COLOR_ESTADO_TAREA } from "@/lib/estado-tarea";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { TabsGrupo } from "../_components/tabs-grupo";
import { crearTareaAction, reasignarTareaAction, cambiarEstadoTareaAction } from "./actions";

type EstadoDb = "pendiente" | "en_progreso" | "en_revision" | "completada";

export default async function TareasGrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; vista?: string; estado?: string; asignado?: string }>;
}) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  const { error, vista, estado, asignado } = await searchParams;

  const resultado = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!resultado) notFound();
  const { grupo, rolActual } = resultado;

  const puedeGestionar = rolActual !== "observador";
  const esVistaLista = vista === "lista";

  const tareas = await listarTareasDelGrupo(sesion.idUsuario, idGrupo, {
    estado: estado as EstadoDb | undefined,
    idAsignado: asignado ? Number(asignado) : undefined,
  });

  const asignables = grupo.integrantes.filter(
    (i) => i.estadoInvitacion === "aceptada" && i.rol !== "observador",
  );

  const crearTareaConId = crearTareaAction.bind(null, idGrupo);

  function accionesDisponibles(tarea: (typeof tareas)[number]) {
    if (!puedeGestionar) return [];
    const esAsignado = tarea.idAsignado === sesion.idUsuario;
    const acciones: { estado: EstadoDb; etiqueta: string }[] = [];

    if (tarea.estado === "pendiente" && (esAsignado || rolActual === "lider")) {
      acciones.push({ estado: "en_progreso", etiqueta: "Empezar" });
    }
    if (tarea.estado === "en_progreso" && esAsignado) {
      acciones.push({ estado: "en_revision", etiqueta: "Enviar a revision" });
    }
    if (tarea.estado === "en_revision" && !esAsignado) {
      acciones.push({ estado: "completada", etiqueta: "Confirmar" });
      acciones.push({ estado: "en_progreso", etiqueta: "Devolver" });
    }
    return acciones;
  }

  function TarjetaTarea({ tarea }: { tarea: (typeof tareas)[number] }) {
    return (
      <li className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-sm">
        <p className="font-medium">{tarea.titulo}</p>
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            {tarea.asignado ? (
              <>
                <Avatar
                  nombre={tarea.asignado.nombre}
                  apellidos={tarea.asignado.apellidos}
                  fotoUrl={tarea.asignado.fotoUrl}
                  tamano="sm"
                />
                {tarea.asignado.nombre}
              </>
            ) : (
              "Sin asignar"
            )}
          </span>
          <span>{"●".repeat(tarea.peso)}</span>
        </div>
        {tarea.fechaLimite ? (
          <p className="text-xs text-text-muted">Limite: {formatearFechaLima(tarea.fechaLimite)}</p>
        ) : null}

        {puedeGestionar ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {accionesDisponibles(tarea).map((accion) => (
              <form
                key={accion.estado}
                action={cambiarEstadoTareaAction.bind(null, idGrupo, tarea.idTarea, accion.estado)}
              >
                <button type="submit" className="text-xs text-primary hover:underline">
                  {accion.etiqueta}
                </button>
              </form>
            ))}
            <details className="ml-auto">
              <summary className="cursor-pointer text-xs text-text-muted hover:text-text">
                Reasignar
              </summary>
              <form
                action={reasignarTareaAction.bind(null, idGrupo, tarea.idTarea)}
                className="mt-2 flex items-center gap-2"
              >
                <select
                  name="idAsignado"
                  defaultValue={tarea.idAsignado ?? ""}
                  className="rounded-md border border-border-strong bg-surface px-2 py-1 text-xs"
                >
                  <option value="">Sin asignar</option>
                  {asignables.map((i) => (
                    <option key={i.idUsuario} value={i.idUsuario}>
                      {i.usuario.nombre}
                    </option>
                  ))}
                </select>
                <button type="submit" className="text-xs text-primary hover:underline">
                  Guardar
                </button>
              </form>
            </details>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <div className="animate-page-in mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Link href="/grupos" className="text-sm text-primary hover:underline">
          Grupos
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{grupo.nombre}</h1>
      </div>

      <TabsGrupo idGrupo={idGrupo} activa="tareas" />

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="vista" value={vista ?? "tablero"} />
          <select
            name="estado"
            defaultValue={estado ?? ""}
            className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">Todos los estados</option>
            {ESTADOS_TAREA_ORDEN.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO_TAREA[e]}
              </option>
            ))}
          </select>
          <select
            name="asignado"
            defaultValue={asignado ?? ""}
            className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">Todos los asignados</option>
            {asignables.map((i) => (
              <option key={i.idUsuario} value={i.idUsuario}>
                {i.usuario.nombre}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-border-strong px-3 py-1.5 text-sm hover:bg-bg"
          >
            Filtrar
          </button>
        </form>

        <div className="flex overflow-hidden rounded-md border border-border-strong text-sm">
          <Link
            href={`?${new URLSearchParams({ ...(estado ? { estado } : {}), ...(asignado ? { asignado } : {}), vista: "tablero" })}`}
            className={`px-3 py-1.5 ${!esVistaLista ? "bg-primary-soft text-primary" : "hover:bg-bg"}`}
          >
            Tablero
          </Link>
          <Link
            href={`?${new URLSearchParams({ ...(estado ? { estado } : {}), ...(asignado ? { asignado } : {}), vista: "lista" })}`}
            className={`px-3 py-1.5 ${esVistaLista ? "bg-primary-soft text-primary" : "hover:bg-bg"}`}
          >
            Lista
          </Link>
        </div>
      </div>

      {esVistaLista ? (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Titulo</th>
                <th className="px-3 py-2 font-medium">Asignado a</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Peso</th>
                <th className="px-3 py-2 font-medium">Fecha limite</th>
              </tr>
            </thead>
            <tbody>
              {tareas.map((tarea) => (
                <tr key={tarea.idTarea} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{tarea.titulo}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      {tarea.asignado ? (
                        <>
                          <Avatar
                            nombre={tarea.asignado.nombre}
                            apellidos={tarea.asignado.apellidos}
                            fotoUrl={tarea.asignado.fotoUrl}
                            tamano="sm"
                          />
                          {tarea.asignado.nombre}
                        </>
                      ) : (
                        <span className="text-text-muted">Sin asignar</span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: COLOR_ESTADO_TAREA[tarea.estado] }}
                        aria-hidden
                      />
                      {ETIQUETA_ESTADO_TAREA[tarea.estado]}
                    </span>
                  </td>
                  <td className="px-3 py-2">{tarea.peso}</td>
                  <td className="px-3 py-2">
                    {tarea.fechaLimite ? formatearFechaLima(tarea.fechaLimite) : "-"}
                  </td>
                </tr>
              ))}
              {tareas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-text-muted">
                    Sin tareas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ESTADOS_TAREA_ORDEN.map((columnaEstado) => (
            <div key={columnaEstado} className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: COLOR_ESTADO_TAREA[columnaEstado] }}
                  aria-hidden
                />
                {ETIQUETA_ESTADO_TAREA[columnaEstado]}
              </p>
              <ul className="flex flex-col gap-2">
                {tareas
                  .filter((t) => t.estado === columnaEstado)
                  .map((tarea) => (
                    <TarjetaTarea key={tarea.idTarea} tarea={tarea} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {puedeGestionar ? (
        <details className="rounded-md border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">Nueva tarea</summary>
          <form action={crearTareaConId} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Titulo
              <input
                name="titulo"
                required
                maxLength={160}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Descripcion (opcional)
              <textarea
                name="descripcion"
                maxLength={1000}
                rows={2}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Asignado a (opcional)
              <select
                name="idAsignado"
                defaultValue=""
                className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
              >
                <option value="">Sin asignar</option>
                {asignables.map((i) => (
                  <option key={i.idUsuario} value={i.idUsuario}>
                    {i.usuario.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Peso (1 a 3)
              <select
                name="peso"
                defaultValue="1"
                className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Fecha limite (opcional)
              <input
                type="date"
                name="fechaLimite"
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <SubmitButton className="mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover sm:col-span-2">
              Crear tarea
            </SubmitButton>
          </form>
        </details>
      ) : null}
    </div>
  );
}
