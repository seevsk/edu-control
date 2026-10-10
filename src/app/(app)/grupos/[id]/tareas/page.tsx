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
import { crearTareaAction } from "./actions";
import { AccionesTarea } from "./_components/acciones-tarea";
import { filtrosTareaSchema, idRegistroSchema } from "@/lib/validation/tarea";

export default async function TareasGrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!idRegistroSchema.safeParse(idGrupo).success) notFound();

  const sesion = await requerirSesion();
  const parametros = await searchParams;
  const filtros = filtrosTareaSchema.safeParse(parametros);
  const { vista, estado, asignado, q } = filtros.success ? filtros.data : filtrosTareaSchema.parse({});
  const error = !filtros.success ? "Los filtros de tareas no son válidos" :
    typeof parametros.error === "string" ? parametros.error : undefined;

  const resultado = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!resultado) notFound();
  const { grupo, rolActual } = resultado;

  const puedeGestionar = rolActual !== "observador" && grupo.estado === "activo";
  const esVistaLista = vista === "lista";

  const tareas = filtros.success ? await listarTareasDelGrupo(sesion.idUsuario, idGrupo, {
    estado: estado || undefined,
    idAsignado: asignado || undefined,
    q,
  }) : [];
  const hayFiltros = Boolean(q || estado || asignado);
  const mensajeVacio = hayFiltros ? "No hay tareas que coincidan con los filtros." : "Sin tareas todavía.";
  const parametrosVista = {
    ...(q ? { q } : {}),
    ...(estado ? { estado } : {}),
    ...(asignado ? { asignado: String(asignado) } : {}),
  };

  const asignables = grupo.integrantes.filter(
    (i) => i.estadoInvitacion === "aceptada" && i.rol !== "observador",
  );

  const crearTareaConId = crearTareaAction.bind(null, idGrupo);

  function TarjetaTarea({ tarea }: { tarea: (typeof tareas)[number] }) {
    return (
      <li className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-sm">
        <Link href={`/grupos/${idGrupo}/tareas/${tarea.idTarea}`} className="break-words font-medium text-primary hover:underline">
          {tarea.titulo}
        </Link>
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
          <span className="flex items-center gap-1" aria-label={`Peso ${tarea.peso} de 3`}>
            {[1, 2, 3].map((nivel) => (
              <span
                key={nivel}
                className={`size-1.5 rounded-full ${nivel <= tarea.peso ? "bg-primary" : "bg-border-strong"}`}
                aria-hidden
              />
            ))}
          </span>
        </div>
        {tarea.fechaLimite ? (
          <p className="text-xs text-text-muted">Limite: {formatearFechaLima(tarea.fechaLimite)}</p>
        ) : null}

        {puedeGestionar ? (
          <AccionesTarea idGrupo={idGrupo} tarea={tarea} idUsuario={sesion.idUsuario} rol={rolActual} asignables={asignables} />
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

      {grupo.estado === "finalizado" ? (
        <p className="rounded-md bg-primary-soft px-3 py-2 text-sm">Este grupo está finalizado. Las tareas son de solo lectura.</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="vista" value={vista ?? "tablero"} />
          <label className="flex flex-col gap-1 text-xs">
            Buscar por título
            <input type="search" name="q" defaultValue={q} maxLength={160} placeholder="Título de la tarea"
              className="rounded-md border border-border-strong px-2 py-1.5 text-sm" />
          </label>
          <select
            name="estado"
            aria-label="Filtrar por estado"
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
            aria-label="Filtrar por responsable"
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
          {hayFiltros ? (
            <Link href={`?vista=${esVistaLista ? "lista" : "tablero"}`} className="text-primary hover:underline">Limpiar filtros</Link>
          ) : null}
        </form>

        <div className="flex overflow-hidden rounded-md border border-border-strong text-sm">
          <Link
            href={`?${new URLSearchParams({ ...parametrosVista, vista: "tablero" })}`}
            className={`px-3 py-1.5 ${!esVistaLista ? "bg-primary-soft text-primary" : "hover:bg-bg"}`}
          >
            Tablero
          </Link>
          <Link
            href={`?${new URLSearchParams({ ...parametrosVista, vista: "lista" })}`}
            className={`px-3 py-1.5 ${esVistaLista ? "bg-primary-soft text-primary" : "hover:bg-bg"}`}
          >
            Lista
          </Link>
        </div>
      </div>

      {!esVistaLista && tareas.length === 0 ? <p className="text-sm text-text-muted">{mensajeVacio}</p> : null}

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
                {puedeGestionar ? <th className="px-3 py-2 font-medium">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {tareas.map((tarea) => (
                <tr key={tarea.idTarea} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/grupos/${idGrupo}/tareas/${tarea.idTarea}`} className="text-primary hover:underline">{tarea.titulo}</Link>
                  </td>
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
                  {puedeGestionar ? (
                    <td className="min-w-64 px-3 py-2">
                      <AccionesTarea idGrupo={idGrupo} tarea={tarea} idUsuario={sesion.idUsuario} rol={rolActual} asignables={asignables} destino="tabla" />
                    </td>
                  ) : null}
                </tr>
              ))}
              {tareas.length === 0 ? (
                <tr>
                  <td colSpan={puedeGestionar ? 6 : 5} className="px-3 py-4 text-center text-text-muted">
                    {mensajeVacio}
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
