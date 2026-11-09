import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { listarTareasDelGrupo, obtenerResumenTareasGrupo } from "@/server/services/tarea";
import { formatearFechaLima } from "@/lib/dates";
import { diasHasta, etiquetaRelativa, fechaEnZonaLimaISO } from "@/lib/calendario";
import { ESTADOS_TAREA_ORDEN, ETIQUETA_ESTADO_TAREA, COLOR_ESTADO_TAREA } from "@/lib/estado-tarea";
import { estaVencida, evaluarEntrega, fechaEstadoActual } from "@/lib/tiempos-tarea";

/** Como en Jira: el tablero solo muestra lo completado recientemente; el resto queda en la lista. */
const DIAS_COMPLETADAS_EN_TABLERO = 14;
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { Modal } from "@/components/modal";
import { TabsGrupo } from "../_components/tabs-grupo";
import { crearTareaAction } from "./actions";
import { AccionesTarea } from "./_components/acciones-tarea";
import { filtrosTareaSchema, idRegistroSchema } from "@/lib/validation/tarea";
import { IconAgregar, IconBuscar, IconCalendario } from "@/components/icons";
import { Toast } from "@/components/toast";

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
  const { vista, estado, asignado, q, foco } = filtros.success ? filtros.data : filtrosTareaSchema.parse({});
  const abrirNuevaTarea = parametros.nueva === "1";
  const toast = typeof parametros.toast === "string" ? parametros.toast : undefined;
  const error = !filtros.success ? "Los filtros de tareas no son válidos" :
    typeof parametros.error === "string" ? parametros.error : undefined;

  const resultado = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!resultado) notFound();
  const { grupo, rolActual } = resultado;

  const puedeGestionar = rolActual !== "observador" && grupo.estado === "activo";
  // El tablero no tiene columna de descartadas: ese filtro siempre se muestra como lista.
  const esVistaLista = vista === "lista" || estado === "descartada";

  const [tareas, resumen] = filtros.success
    ? await Promise.all([
        listarTareasDelGrupo(sesion.idUsuario, idGrupo, {
          estado: estado || undefined,
          idAsignado: asignado || undefined,
          q,
          foco: foco || undefined,
        }),
        obtenerResumenTareasGrupo(sesion.idUsuario, idGrupo),
      ])
    : [[], await obtenerResumenTareasGrupo(sesion.idUsuario, idGrupo)];
  const hayFiltros = Boolean(q || estado || asignado || foco);
  const mensajeVacio = hayFiltros ? "No hay tareas que coincidan con los filtros." : "Sin tareas todavía.";
  const parametrosVista = {
    ...(q ? { q } : {}),
    ...(estado ? { estado } : {}),
    ...(asignado ? { asignado: String(asignado) } : {}),
    ...(foco ? { foco } : {}),
  };
  const filtrosRetorno = { q, estado, asignado, foco };
  const ahora = new Date();
  const hoyISO = fechaEnZonaLimaISO(ahora);
  const limiteGrupoISO = grupo.fechaLimite ? fechaEnZonaLimaISO(grupo.fechaLimite) : undefined;

  const asignables = grupo.integrantes.filter(
    (i) => i.estadoInvitacion === "aceptada" && i.rol !== "observador",
  );

  const crearTareaConId = crearTareaAction.bind(null, idGrupo);

  function hrefConFiltros(cambios: Record<string, string | undefined>) {
    const parametrosDestino = new URLSearchParams({
      ...parametrosVista,
      vista: esVistaLista ? "lista" : "tablero",
    });
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) parametrosDestino.set(clave, valor);
      else parametrosDestino.delete(clave);
    }
    return `?${parametrosDestino.toString()}`;
  }

  const limiteCompletadas = ahora.getTime() - DIAS_COMPLETADAS_EN_TABLERO * 86_400_000;
  const completadasAntiguas = tareas.filter((tarea) => {
    if (tarea.estado !== "completada") return false;
    const completadaEn = fechaEstadoActual(tarea.historial);
    return completadaEn !== null && completadaEn.getTime() < limiteCompletadas;
  });

  function PresentacionFecha({ tarea }: { tarea: (typeof tareas)[number] }) {
    const fecha = tarea.fechaLimite;
    if (!fecha) return <span className="text-text-muted">Sin fecha límite</span>;
    const cerrada = tarea.estado === "completada" || tarea.estado === "descartada";
    const vencida = estaVencida(tarea, ahora);
    const urgente = !cerrada && diasHasta(fecha, ahora) <= 2;
    const conAtraso = tarea.estado === "completada" && evaluarEntrega(tarea, tarea.historial)?.aTiempo === false;
    return (
      <span className={`inline-flex flex-wrap items-center gap-1.5 ${urgente ? "font-medium text-danger" : "text-text-muted"}`}>
        <IconCalendario className="size-3.5 shrink-0" aria-hidden />
        <span title={formatearFechaLima(fecha)}>{cerrada ? formatearFechaLima(fecha) : etiquetaRelativa(fecha, ahora)}</span>
        {vencida ? <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium text-danger">Vencida</span> : null}
        {conAtraso ? <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium text-danger">Entregada con atraso</span> : null}
      </span>
    );
  }

  function TarjetaTarea({ tarea }: { tarea: (typeof tareas)[number] }) {
    return (
      <li
        className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 text-sm shadow-sm transition-shadow hover:shadow-md"
        style={{ borderTopColor: COLOR_ESTADO_TAREA[tarea.estado], borderTopWidth: 3 }}
      >
        <Link href={`/grupos/${idGrupo}/tareas/${tarea.idTarea}`} className="break-words font-semibold text-text hover:text-primary hover:underline">
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
        <p className="text-xs"><PresentacionFecha tarea={tarea} /></p>

        {puedeGestionar ? (
          <AccionesTarea
            idGrupo={idGrupo}
            tarea={tarea}
            idUsuario={sesion.idUsuario}
            rol={rolActual}
            asignables={asignables}
            filtros={filtrosRetorno}
          />
        ) : null}
      </li>
    );
  }

  return (
    <div className="animate-page-in mx-auto flex max-w-6xl flex-col gap-6">
      <Toast mensaje={toast} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/grupos" className="text-sm text-primary hover:underline">
            Grupos
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{grupo.nombre}</h1>
        </div>
        {puedeGestionar ? (
          <Link
            href={hrefConFiltros({ nueva: "1" })}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <IconAgregar className="size-4" aria-hidden />
            Nueva tarea
          </Link>
        ) : null}
      </div>

      <TabsGrupo idGrupo={idGrupo} activa="tareas" mostrarConfiguracion={rolActual === "lider"} />

      <section aria-label="Resumen de tareas" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={hrefConFiltros({ foco: "abiertas", estado: undefined, asignado: undefined })} className={`rounded-md border bg-surface p-3 hover:border-primary/50 hover:shadow-sm ${foco === "abiertas" ? "border-primary ring-1 ring-primary/20" : "border-border"}`}>
          <span className="text-xs text-text-muted">Tareas abiertas</span>
          <strong className="mt-1 block text-2xl font-semibold">{resumen.abiertas}</strong>
        </Link>
        <Link href={hrefConFiltros({ foco: "mias", estado: undefined, asignado: undefined })} className={`rounded-md border bg-surface p-3 hover:border-primary/50 hover:shadow-sm ${foco === "mias" ? "border-primary ring-1 ring-primary/20" : "border-border"}`}>
          <span className="text-xs text-text-muted">Mis tareas abiertas</span>
          <strong className="mt-1 block text-2xl font-semibold text-primary">{resumen.mias}</strong>
        </Link>
        <Link href={hrefConFiltros({ foco: "vencidas", estado: undefined, asignado: undefined })} className={`rounded-md border bg-surface p-3 hover:border-danger/50 hover:shadow-sm ${foco === "vencidas" ? "border-danger ring-1 ring-danger/20" : "border-border"}`}>
          <span className="text-xs text-text-muted">Vencidas</span>
          <strong className={`mt-1 block text-2xl font-semibold ${resumen.vencidas ? "text-danger" : ""}`}>{resumen.vencidas}</strong>
        </Link>
        <Link href={hrefConFiltros({ estado: "en_revision", foco: undefined, asignado: undefined })} className={`rounded-md border bg-surface p-3 hover:border-primary/50 hover:shadow-sm ${estado === "en_revision" && !foco ? "border-primary ring-1 ring-primary/20" : "border-border"}`}>
          <span className="text-xs text-text-muted">Esperando revisión</span>
          <strong className="mt-1 block text-2xl font-semibold">{resumen.enRevision}</strong>
        </Link>
      </section>

      {error && !abrirNuevaTarea ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {grupo.estado === "finalizado" ? (
        <p className="rounded-md bg-primary-soft px-3 py-2 text-sm">Este grupo está finalizado. Las tareas son de solo lectura.</p>
      ) : null}

      <section aria-label="Filtros de tareas" className="rounded-md border border-border bg-surface p-3">
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="vista" value={vista ?? "tablero"} />
          <label className="flex min-w-52 flex-1 flex-col gap-1 text-xs">
            Buscar
            <span className="relative">
              <IconBuscar className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
              <input type="search" name="q" defaultValue={q} maxLength={160} placeholder="Título o descripción"
                className="w-full rounded-md border border-border-strong py-1.5 pl-8 pr-2 text-sm" />
            </span>
          </label>
          <label className="flex flex-col gap-1 text-xs">Estado
            <select name="estado" defaultValue={estado ?? ""} className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm">
              <option value="">Todos</option>
              {ESTADOS_TAREA_ORDEN.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO_TAREA[e]}</option>)}
              <option value="descartada">{ETIQUETA_ESTADO_TAREA.descartada}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">Responsable
            <select name="asignado" defaultValue={asignado ?? ""} className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm">
              <option value="">Todos</option>
              {asignables.map((i) => <option key={i.idUsuario} value={i.idUsuario}>{i.usuario.nombre}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">Vista rápida
            <select name="foco" defaultValue={foco ?? ""} className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm">
              <option value="">Todas</option>
              <option value="abiertas">Abiertas</option>
              <option value="mias">Mis tareas</option>
              <option value="sin_asignar">Sin asignar</option>
              <option value="vencidas">Vencidas</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Filtrar
          </button>
          {hayFiltros ? (
            <Link href={`?vista=${esVistaLista ? "lista" : "tablero"}`} className="px-2 py-1.5 text-primary hover:underline">Limpiar</Link>
          ) : null}
        </form>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          {resumen.sinAsignar > 0 ? `${resumen.sinAsignar} ${resumen.sinAsignar === 1 ? "tarea abierta sin responsable" : "tareas abiertas sin responsable"}. ` : ""}
          El peso representa el impacto de cada tarea en el avance del grupo.
          {resumen.descartadas > 0 && estado !== "descartada" ? (
            <>
              {" "}
              <Link href={hrefConFiltros({ estado: "descartada", foco: undefined, vista: "lista" })} className="text-primary hover:underline">
                Ver descartadas ({resumen.descartadas})
              </Link>
            </>
          ) : null}
        </p>
        <div className="flex overflow-hidden rounded-md border border-border-strong bg-surface text-sm">
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
                <th className="px-3 py-2 font-medium">Título</th>
                <th className="px-3 py-2 font-medium">Asignado a</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Peso</th>
                <th className="px-3 py-2 font-medium">Fecha límite</th>
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
                    <PresentacionFecha tarea={tarea} />
                  </td>
                  {puedeGestionar ? (
                    <td className="min-w-64 px-3 py-2">
                      <AccionesTarea idGrupo={idGrupo} tarea={tarea} idUsuario={sesion.idUsuario} rol={rolActual} asignables={asignables} destino="tabla" filtros={filtrosRetorno} />
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
          {ESTADOS_TAREA_ORDEN.map((columnaEstado) => {
            const ocultas = columnaEstado === "completada" && estado !== "completada" ? completadasAntiguas : [];
            const tareasColumna = tareas.filter((tarea) => tarea.estado === columnaEstado && !ocultas.includes(tarea));
            return (
            <section key={columnaEstado} className="flex min-h-64 flex-col gap-3 rounded-md border border-border bg-bg/60 p-2.5">
              <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: COLOR_ESTADO_TAREA[columnaEstado] }}
                  aria-hidden
                />
                {ETIQUETA_ESTADO_TAREA[columnaEstado]}
                <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-normal text-text-muted">{tareasColumna.length}</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {tareasColumna.map((tarea) => <TarjetaTarea key={tarea.idTarea} tarea={tarea} />)}
              </ul>
              {tareasColumna.length === 0 ? <p className="m-auto px-3 text-center text-xs text-text-muted">No hay tareas en este estado.</p> : null}
              {ocultas.length > 0 ? (
                <Link
                  href={hrefConFiltros({ estado: "completada", foco: undefined, vista: "lista" })}
                  className="px-1 text-xs text-primary hover:underline"
                >
                  Ver anteriores ({ocultas.length})
                </Link>
              ) : null}
            </section>
          );})}
        </div>
      )}

      {puedeGestionar && abrirNuevaTarea ? (
        <Modal
          titulo="Nueva tarea"
          descripcion="Define el responsable, el peso y una fecha dentro del plazo del grupo."
          cerrarEn={hrefConFiltros({})}
        >
          {error ? (
            <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <form action={crearTareaConId} className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Título
              <input
                name="titulo"
                required
                maxLength={160}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Descripción (opcional)
              <textarea
                name="descripcion"
                maxLength={1000}
                rows={2}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Responsable
              <select
                name="idAsignado"
                defaultValue=""
                required
                className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
              >
                <option value="" disabled>Selecciona un responsable</option>
                {asignables.map((i) => (
                  <option key={i.idUsuario} value={i.idUsuario}>
                    {i.usuario.nombre} · carga abierta {resumen.pesoAbiertoPorUsuario[i.idUsuario] ?? 0}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Peso de la tarea
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
              Fecha límite
              <input
                type="date"
                name="fechaLimite"
                min={hoyISO}
                max={limiteGrupoISO}
                required
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
              <span className="text-xs text-text-muted">
                {grupo.fechaLimite ? `Hasta la fecha límite del grupo: ${formatearFechaLima(grupo.fechaLimite)}` : "No puede estar en el pasado."}
              </span>
            </label>
            <SubmitButton className="mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover sm:col-span-2">
              Crear tarea
            </SubmitButton>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
