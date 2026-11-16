import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { aOracion } from "@/lib/presentacion";

/** Una sola consulta por petición aunque la pidan el título y la página. */
const nombreDelGrupo = cache(async (idGrupo: number) => {
  const sesion = await requerirSesion();
  const resultado = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  return resultado ? aOracion(resultado.grupo.nombre) : null;
});

/** Título de la pestaña de un grupo: "Horarios · Grupo 7 · EduControl". */
export function metadataDeGrupo(seccion: string | null) {
  return async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const nombre = Number.isInteger(Number(id)) ? await nombreDelGrupo(Number(id)) : null;
    // Sin acceso: 404 desde el título, antes de que empiece a transmitirse la página.
    if (!nombre) notFound();
    return { title: seccion ? `${seccion} · ${nombre}` : nombre };
  };
}
