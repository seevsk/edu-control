import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerReunion } from "@/server/services/reunion";
import { nombrePila } from "@/lib/nombres";
import { Toast } from "@/components/toast";
import { DetalleReunion } from "./_components/detalle-reunion";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; toast?: string }> };

function idValido(texto: string): number | null {
  return /^[1-9]\d{0,9}$/.test(texto) && Number(texto) <= 2_147_483_647 ? Number(texto) : null;
}

// Una sola consulta por petición para el título y la página.
const cargar = cache((idUsuario: number, idReunion: number) => obtenerReunion(idUsuario, idReunion));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const idReunion = idValido(id);
  const sesion = await requerirSesion();
  const datos = idReunion ? await cargar(sesion.idUsuario, idReunion) : null;
  return { title: datos?.reunion.titulo ?? "Reunión" };
}

function ahoraISO() {
  return new Date().toISOString();
}

export default async function DetalleReunionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error, toast } = await searchParams;
  const idReunion = idValido(id);
  if (!idReunion) notFound();

  const sesion = await requerirSesion();
  const datos = await cargar(sesion.idUsuario, idReunion);
  if (!datos) notFound();

  const { reunion, rol, moderador } = datos;
  const observador = rol === "observador";

  return (
    <>
      <Toast mensaje={toast} />
      {error ? (
        <p role="alert" className="mx-auto mt-4 w-full max-w-[760px] rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <DetalleReunion
        datos={{
          ahoraInicial: ahoraISO(),
          idUsuario: sesion.idUsuario,
          reunion: {
            idReunion: reunion.idReunion,
            titulo: reunion.titulo,
            inicio: reunion.inicio,
            fin: reunion.fin,
            lugar: reunion.lugar,
            enlace: reunion.enlace,
            videollamada: reunion.videollamada,
            iniciadaEn: reunion.iniciadaEn,
            finalizadaEn: reunion.finalizadaEn,
            asistentes: reunion.asistentes,
          },
          grupo: { idGrupo: reunion.grupo.idGrupo, nombre: reunion.grupo.nombre, idCurso: reunion.grupo.evaluacion?.idCurso ?? null },
          observador,
          moderador: moderador && !observador,
          puedeCancelarBase: !observador && (reunion.idCreador === sesion.idUsuario || rol === "lider"),
          finalizadoPor: reunion.finalizador ? nombrePila(reunion.finalizador.nombre) : null,
        }}
      />
    </>
  );
}
