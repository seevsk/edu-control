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

export default async function TareaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; idTarea: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
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
  const { error } = await searchParams;
  const puedeGestionar = rolActual !== "observador" && grupo.estado === "activo";
  const asignables = grupo.integrantes.filter((integrante) =>
    integrante.estadoInvitacion === "aceptada" && integrante.rol !== "observador",
  );
  const nombres = new Map(grupo.integrantes.map((integrante) => [
    integrante.idUsuario,
    `${integrante.usuario.nombre} ${integrante.usuario.apellidos ?? ""}`.trim(),
  ]));

  return (
    <div className="animate-page-in mx-auto flex max-w-3xl flex-col gap-6">
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

      <section className="rounded-md border border-border bg-surface p-4 sm:p-5">
        <h1 className="break-words text-xl font-semibold">{tarea.titulo}</h1>
        <p className="mt-2 flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_ESTADO_TAREA[tarea.estado] }} aria-hidden />
          {ETIQUETA_ESTADO_TAREA[tarea.estado]}
        </p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-muted">Responsable</dt>
            <dd className="mt-1 flex items-center gap-2">
              {tarea.asignado ? (
                <>
                  <Avatar nombre={tarea.asignado.nombre} apellidos={tarea.asignado.apellidos} fotoUrl={tarea.asignado.fotoUrl} tamano="sm" />
                  {tarea.asignado.nombre} {tarea.asignado.apellidos ?? ""}
                </>
              ) : "Sin asignar"}
            </dd>
          </div>
          <div><dt className="text-xs text-text-muted">Peso</dt><dd className="mt-1">{tarea.peso} de 3</dd></div>
          <div><dt className="text-xs text-text-muted">Fecha límite</dt><dd className="mt-1">{tarea.fechaLimite ? formatearFechaHoraLima(tarea.fechaLimite) : "Sin fecha límite"}</dd></div>
          <div><dt className="text-xs text-text-muted">Creada por</dt><dd className="mt-1">{tarea.creador.nombre} {tarea.creador.apellidos ?? ""}</dd></div>
        </dl>
        <div className="mt-5 border-t border-border pt-4">
          <h2 className="text-sm font-medium">Descripción</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-muted">{tarea.descripcion || "Sin descripción."}</p>
        </div>
        {puedeGestionar ? (
          <div className="mt-5 border-t border-border pt-4">
            <h2 className="mb-2 text-sm font-medium">Acciones</h2>
            <AccionesTarea idGrupo={idGrupo} tarea={tarea} idUsuario={sesion.idUsuario} rol={rolActual} asignables={asignables} destino="detalle" />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="historial-tarea" className="flex flex-col gap-3">
        <h2 id="historial-tarea" className="text-base font-semibold">Historial de la tarea</h2>
        <HistorialTareas entradas={tarea.historial} nombres={nombres} idGrupo={idGrupo} />
      </section>
    </div>
  );
}
