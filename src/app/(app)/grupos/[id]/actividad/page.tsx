import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerFeedActividad } from "@/server/services/metricas";
import { prisma } from "@/server/db/client";
import { ETIQUETA_ESTADO_TAREA } from "@/lib/estado-tarea";
import { TabsGrupo } from "../_components/tabs-grupo";

function describirEntrada(entrada: Awaited<ReturnType<typeof obtenerFeedActividad>>[number]) {
  const quien = entrada.usuario.nombre;
  const tarea = entrada.tarea.titulo;

  if (entrada.accion === "creada") return `${quien} creo la tarea "${tarea}"`;
  if (entrada.accion === "reasignada") return `${quien} reasigno "${tarea}"`;
  if (entrada.accion === "estado") {
    const nuevo = entrada.valorNuevo ? ETIQUETA_ESTADO_TAREA[entrada.valorNuevo] ?? entrada.valorNuevo : "";
    return `${quien} paso "${tarea}" a ${nuevo}`;
  }
  return `${quien} actualizo "${tarea}"`;
}

export default async function ActividadGrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  const grupo = await prisma.grupo.findUnique({ where: { idGrupo } });
  if (!grupo) notFound();

  const feed = await obtenerFeedActividad(sesion.idUsuario, idGrupo).catch(() => null);
  if (!feed) notFound();

  return (
    <div className="animate-page-in mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/grupos" className="text-sm text-primary hover:underline">
          Grupos
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{grupo.nombre}</h1>
      </div>

      <TabsGrupo idGrupo={idGrupo} activa="actividad" />

      <ul className="flex flex-col gap-3">
        {feed.map((entrada) => (
          <li key={entrada.idHistorial} className="rounded-md border border-border bg-surface p-3 text-sm">
            <p>{describirEntrada(entrada)}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {entrada.fecha.toLocaleString("es-PE", { timeZone: "America/Lima" })}
            </p>
          </li>
        ))}
        {feed.length === 0 ? (
          <p className="text-sm text-text-muted">Todavia no hay actividad en este grupo.</p>
        ) : null}
      </ul>
    </div>
  );
}
