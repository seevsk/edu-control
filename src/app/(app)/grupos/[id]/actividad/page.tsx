import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerFeedActividad } from "@/server/services/metricas";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { MarcoGrupo } from "../_components/marco-grupo";
import { HistorialTareas } from "../_components/historial-tareas";
import { nombreCorto } from "@/lib/nombres";

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
    nombreCorto(integrante.usuario.nombre, integrante.usuario.apellidos),
  ]));

  const feed = await obtenerFeedActividad(sesion.idUsuario, idGrupo).catch(() => null);
  if (!feed) notFound();

  return (
    <MarcoGrupo datos={resultado} idUsuario={sesion.idUsuario} activa="actividad">
      <HistorialTareas entradas={feed} nombres={nombres} idGrupo={idGrupo} />
    </MarcoGrupo>
  );
}
