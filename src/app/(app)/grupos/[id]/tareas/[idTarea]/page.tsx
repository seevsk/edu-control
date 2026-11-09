import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { obtenerTareaDelGrupo } from "@/server/services/tarea";
import { idRegistroSchema } from "@/lib/validation/tarea";
import { formatearDuracion, formatearFechaHoraLima } from "@/lib/dates";
import { nombreCorto } from "@/lib/nombres";
import { PesoTarea } from "@/components/peso-tarea";
import { ETIQUETA_ESTADO_TAREA, COLOR_ESTADO_TAREA, estaAbierta } from "@/lib/estado-tarea";
import { estaVencida } from "@/lib/tiempos-tarea";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { TabsGrupo } from "../../_components/tabs-grupo";
import { AccionesTarea } from "../_components/acciones-tarea";
import { LineaTiempoTarea } from "../_components/linea-tiempo-tarea";
import { RegistrarVista } from "../_components/registrar-vista";
import { editarTareaAction } from "../actions";
import { Toast } from "@/components/toast";
import { etiquetaRelativa, fechaEnZonaLimaISO } from "@/lib/calendario";

export default async function TareaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; idTarea: string }>;
  searchParams: Promise<{ error?: string | string[]; toast?: string | string[]; editar?: string | string[] }>;
}) {
  const ruta = await params;
  const grupoId = idRegistroSchema.safeParse(ruta.id);
  const tareaId = idRegistroSchema.safeParse(ruta.idTarea);
  if (!grupoId.success || !tareaId.success) notFound();
  const idGrupo = grupoId.data;
  const idTarea = tareaId.data;
  const sesion = await requerirSesion();

  const resultado = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!resultado) notFound();
  const tarea = await obtenerTareaDelGrupo(sesion.idUsuario, idGrupo, idTarea).catch(() => null);
  if (!tarea) notFound();

  const { grupo, rolActual } = resultado;
  const { error, toast, editar } = await searchParams;
  const ahora = new Date();
  const puedeGestionar = rolActual !== "observador" && grupo.estado === "activo";
  const puedeEditar = puedeGestionar && estaAbierta(tarea.estado) && (rolActual === "lider" || tarea.idCreador === sesion.idUsuario);
  const abrirEdicion = puedeEditar && editar === "1";
  const vencida = estaVencida(tarea, ahora);
  const rutaDetalle = `/grupos/${idGrupo}/tareas/${idTarea}`;
  const asignables = grupo.integrantes.filter((integrante) =>
    integrante.estadoInvitacion === "aceptada" && integrante.rol !== "observador",
  );
  const nombres = new Map(grupo.integrantes.map((integrante) => [
    integrante.idUsuario,
    nombreCorto(integrante.usuario.nombre, integrante.usuario.apellidos),
  ]));
  const hoyISO = fechaEnZonaLimaISO(ahora);
  const limiteGrupoISO = grupo.fechaLimite ? fechaEnZonaLimaISO(grupo.fechaLimite) : undefined;

  return (
    <div className="animate-page-in mx-auto flex max-w-5xl flex-col gap-6">
      <Toast mensaje={typeof toast === "string" ? toast : undefined} />
      {tarea.idAsignado === sesion.idUsuario && estaAbierta(tarea.estado) && grupo.estado === "activo" ? (
        <RegistrarVista idGrupo={idGrupo} idTarea={idTarea} />
      ) : null}
      <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/grupos" className="text-primary hover:underline">Grupos</Link>
        <span aria-hidden>/</span>
        <Link href={`/grupos/${idGrupo}`} className="text-primary hover:underline">{grupo.nombre}</Link>
        <span aria-hidden>/</span>
        <Link href={`/grupos/${idGrupo}/tareas`} className="text-primary hover:underline">Tareas</Link>
      </nav>

      <TabsGrupo idGrupo={idGrupo} activa="tareas" />

      {typeof error === "string" && !abrirEdicion ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}
      {grupo.estado === "finalizado" ? (
        <p className="rounded-md bg-primary-soft px-3 py-2 text-sm">Este grupo está finalizado. La tarea es de solo lectura.</p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="rounded-md border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className={`break-words text-xl font-semibold ${tarea.estado === "descartada" ? "text-text-muted line-through" : ""}`}>
              {tarea.titulo}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {vencida && tarea.fechaLimite ? (
                <span className="inline-flex items-center rounded-full bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger">
                  Vencida hace {formatearDuracion(ahora.getTime() - tarea.fechaLimite.getTime())}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-2 rounded-full bg-bg px-2.5 py-1 text-xs font-medium">
                <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_ESTADO_TAREA[tarea.estado] }} aria-hidden />
                {ETIQUETA_ESTADO_TAREA[tarea.estado]}
              </span>
              {puedeEditar ? (
                <Link
                  href={`${rutaDetalle}?editar=1`}
                  scroll={false}
                  className="rounded-md border border-border-strong px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
                >
                  Editar
                </Link>
              ) : null}
            </div>
          </div>
          <dl className="mt-5 grid gap-4 border-y border-border py-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-muted">Responsable</dt>
              <dd className="mt-1 flex items-center gap-2">
                {tarea.asignado ? (
                  <>
                    <Avatar nombre={tarea.asignado.nombre} apellidos={tarea.asignado.apellidos} fotoUrl={tarea.asignado.fotoUrl} tamano="sm" />
                    {nombreCorto(tarea.asignado.nombre, tarea.asignado.apellidos)}
                  </>
                ) : <span className="text-text-muted">Sin asignar</span>}
              </dd>
            </div>
            <div><dt className="text-xs text-text-muted">Peso</dt><dd className="mt-2"><PesoTarea peso={tarea.peso} /></dd></div>
            <div>
              <dt className="text-xs text-text-muted">Fecha límite</dt>
              <dd className="mt-1">{tarea.fechaLimite ? <><span className={`font-medium ${vencida ? "text-danger" : ""}`}>{etiquetaRelativa(tarea.fechaLimite, ahora)}</span><span className="block text-xs text-text-muted">{formatearFechaHoraLima(tarea.fechaLimite)}</span></> : "Sin fecha límite"}</dd>
            </div>
            <div><dt className="text-xs text-text-muted">Creada por</dt><dd className="mt-1">{nombreCorto(tarea.creador.nombre, tarea.creador.apellidos)}</dd></div>
          </dl>
          <div className="mt-5">
            <h2 className="text-sm font-semibold">Descripción</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-muted">{tarea.descripcion || "Sin descripción."}</p>
          </div>
          {puedeGestionar ? (
            <AccionesTarea idGrupo={idGrupo} tarea={tarea} idUsuario={sesion.idUsuario} rol={rolActual} asignables={asignables} destino="detalle" titulo="Siguiente acción" />
          ) : null}
        </section>

        <section aria-labelledby="seguimiento-tarea" className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-sm">
          <h2 id="seguimiento-tarea" className="text-base font-semibold">Seguimiento</h2>
          <LineaTiempoTarea tarea={tarea} historial={tarea.historial} nombres={nombres} ahora={ahora} />
        </section>
      </div>

      {abrirEdicion ? (
        <Modal titulo="Editar tarea" cerrarEn={rutaDetalle}>
          {typeof error === "string" ? (
            <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}
          <form action={editarTareaAction.bind(null, idGrupo, idTarea)} className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Título
              <input name="titulo" required maxLength={160} defaultValue={tarea.titulo} className="rounded-md border border-border-strong px-3 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Descripción (opcional)
              <textarea name="descripcion" maxLength={1000} rows={3} defaultValue={tarea.descripcion ?? ""} className="rounded-md border border-border-strong px-3 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Peso de la tarea
              <select name="peso" defaultValue={String(tarea.peso)} className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm">
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
                required
                defaultValue={tarea.fechaLimite ? fechaEnZonaLimaISO(tarea.fechaLimite) : undefined}
                min={vencida ? undefined : hoyISO}
                max={limiteGrupoISO}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
              />
            </label>
            <SubmitButton className="mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover sm:col-span-2">
              Guardar cambios
            </SubmitButton>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
