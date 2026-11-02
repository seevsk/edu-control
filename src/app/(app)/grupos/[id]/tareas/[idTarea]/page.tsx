import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { obtenerTareaDelGrupo } from "@/server/services/tarea";
import { idRegistroSchema } from "@/lib/validation/tarea";
import { formatearFechaHoraLima } from "@/lib/dates";
import { ETIQUETA_ESTADO_TAREA, COLOR_ESTADO_TAREA } from "@/lib/estado-tarea";
import { Avatar } from "@/components/avatar";
import { TabsGrupo } from "../../_components/tabs-grupo";
import { HistorialTareas } from "../../_components/historial-tareas";
import { AccionesTarea } from "../_components/acciones-tarea";
import { Toast } from "@/components/toast";
import { etiquetaRelativa } from "@/lib/calendario";

export default async function TareaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; idTarea: string }>;
  searchParams: Promise<{ error?: string | string[]; toast?: string | string[] }>;
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
  const { error, toast } = await searchParams;
  const puedeGestionar = rolActual !== "observador" && grupo.estado === "activo";
  const asignables = grupo.integrantes.filter((integrante) =>
    integrante.estadoInvitacion === "aceptada" && integrante.rol !== "observador",
  );
  const nombres = new Map(grupo.integrantes.map((integrante) => [
    integrante.idUsuario,
    `${integrante.usuario.nombre} ${integrante.usuario.apellidos ?? ""}`.trim(),
  ]));

  return (
    <div className="animate-page-in mx-auto flex max-w-5xl flex-col gap-6">
      <Toast mensaje={typeof toast === "string" ? toast : undefined} />
      <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/grupos" className="text-primary hover:underline">Grupos</Link>
        <span aria-hidden>/</span>
        <Link href={`/grupos/${idGrupo}`} className="text-primary hover:underline">{grupo.nombre}</Link>
        <span aria-hidden>/</span>
        <Link href={`/grupos/${idGrupo}/tareas`} className="text-primary hover:underline">Tareas</Link>
      </nav>

      <TabsGrupo idGrupo={idGrupo} activa="tareas" />

      {typeof error === "string" ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}
      {grupo.estado === "finalizado" ? (
        <p className="rounded-md bg-primary-soft px-3 py-2 text-sm">Este grupo está finalizado. La tarea es de solo lectura.</p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-md border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="break-words text-xl font-semibold">{tarea.titulo}</h1>
            <span className="inline-flex items-center gap-2 rounded-full bg-bg px-2.5 py-1 text-xs font-medium">
              <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_ESTADO_TAREA[tarea.estado] }} aria-hidden />
              {ETIQUETA_ESTADO_TAREA[tarea.estado]}
            </span>
          </div>
          <dl className="mt-5 grid gap-4 border-y border-border py-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-muted">Responsable</dt>
              <dd className="mt-1 flex items-center gap-2">
                {tarea.asignado ? (
                  <>
                    <Avatar nombre={tarea.asignado.nombre} apellidos={tarea.asignado.apellidos} fotoUrl={tarea.asignado.fotoUrl} tamano="sm" />
                    {tarea.asignado.nombre} {tarea.asignado.apellidos ?? ""}
                  </>
                ) : <span className="text-danger">Sin asignar</span>}
              </dd>
            </div>
            <div><dt className="text-xs text-text-muted">Peso</dt><dd className="mt-1">{tarea.peso} de 3</dd></div>
            <div>
              <dt className="text-xs text-text-muted">Fecha límite</dt>
              <dd className="mt-1">{tarea.fechaLimite ? <><span className="font-medium">{etiquetaRelativa(tarea.fechaLimite)}</span><span className="block text-xs text-text-muted">{formatearFechaHoraLima(tarea.fechaLimite)}</span></> : "Sin fecha límite"}</dd>
            </div>
            <div><dt className="text-xs text-text-muted">Creada por</dt><dd className="mt-1">{tarea.creador.nombre} {tarea.creador.apellidos ?? ""}</dd></div>
          </dl>
          <div className="mt-5">
            <h2 className="text-sm font-semibold">Descripción</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-muted">{tarea.descripcion || "Sin descripción."}</p>
          </div>
          {puedeGestionar ? (
            <div className="mt-5 rounded-md border border-border bg-bg/60 p-3">
              <h2 className="mb-2 text-sm font-semibold">Siguiente acción</h2>
              <AccionesTarea idGrupo={idGrupo} tarea={tarea} idUsuario={sesion.idUsuario} rol={rolActual} asignables={asignables} destino="detalle" />
            </div>
          ) : null}
        </section>

        <section aria-labelledby="historial-tarea" className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-sm">
          <h2 id="historial-tarea" className="text-base font-semibold">Historial de la tarea</h2>
          <HistorialTareas entradas={tarea.historial} nombres={nombres} idGrupo={idGrupo} />
        </section>
      </div>
    </div>
  );
}
