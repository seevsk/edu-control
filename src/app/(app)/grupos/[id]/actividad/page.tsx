import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerFeedActividad } from "@/server/services/metricas";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { TabsGrupo } from "../_components/tabs-grupo";
import { HistorialTareas } from "../_components/historial-tareas";

export default async function ActividadGrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  const resultado = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!resultado) notFound();
  const { grupo } = resultado;
  const nombres = new Map(grupo.integrantes.map((integrante) => [
    integrante.idUsuario,
    `${integrante.usuario.nombre} ${integrante.usuario.apellidos ?? ""}`.trim(),
  ]));

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

      <HistorialTareas entradas={feed} nombres={nombres} idGrupo={idGrupo} />
    </div>
  );
}
