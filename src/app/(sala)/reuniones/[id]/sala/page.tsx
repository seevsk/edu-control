import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Clock, DoorOpen } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { datosDeSala, obtenerReunion } from "@/server/services/reunion";
import { ventanaSala } from "@/lib/estado-reunion";
import { hora } from "@/lib/formato-fecha";
import { nombreCorto } from "@/lib/nombres";
import { quienInicio } from "@/components/ui-app/reuniones/formato";
import { EnlaceEstado, MarcoEstadoSala } from "./_components/marco-estado-sala";
import { SalaReunion } from "./_components/sala-reunion";

export const metadata: Metadata = { title: "Sala" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ya?: string }> };

function ahoraISO() {
  return new Date().toISOString();
}

export default async function SalaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { ya } = await searchParams;
  if (!/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2_147_483_647) notFound();
  const idReunion = Number(id);

  const sesion = await requerirSesion();
  // Observadores, no integrantes y reuniones sin videollamada: 404 (el servicio devuelve null).
  const [sala, detalle] = await Promise.all([datosDeSala(sesion.idUsuario, idReunion), obtenerReunion(sesion.idUsuario, idReunion)]);
  if (!sala || !detalle) notFound();
  if (sala.tipo === "requiere_unirse") redirect(`/reuniones/${idReunion}`);

  const { reunion } = detalle;
  const grupo = { nombre: reunion.grupo.nombre, idCurso: reunion.grupo.evaluacion?.idCurso ?? null };
  const volver = `/reuniones/${idReunion}`;

  if (sala.tipo === "cerrada") {
    if (sala.estado === "programada") {
      const { apertura } = ventanaSala(reunion.inicio, reunion.fin);
      return (
        <MarcoEstadoSala idReunion={idReunion} titulo={reunion.titulo} grupo={grupo} icono={<Clock aria-hidden />} texto={`La sala abre a las ${hora(apertura)}`}>
          <EnlaceEstado href={volver}>Volver</EnlaceEstado>
        </MarcoEstadoSala>
      );
    }
    return (
      <MarcoEstadoSala idReunion={idReunion} titulo={reunion.titulo} grupo={grupo} icono={<DoorOpen aria-hidden />} texto="Esta reunión terminó">
        <EnlaceEstado href={volver} variante="default">
          Ver detalle
        </EnlaceEstado>
      </MarcoEstadoSala>
    );
  }

  // "Reunirse ahora" entró a una reunión que otra persona ya había iniciado.
  const primero = ya === "1" ? quienInicio(reunion.asistentes) : null;
  const iniciadoPor = primero && primero.idUsuario !== sesion.idUsuario ? nombreCorto(primero.usuario.nombre, primero.usuario.apellidos) : null;

  return (
    <SalaReunion
      idReunion={idReunion}
      titulo={sala.titulo}
      grupo={grupo}
      credenciales={sala.credenciales}
      cierre={sala.cierre}
      ahoraInicial={ahoraISO()}
      moderador={sala.moderador}
      iniciadoPor={iniciadoPor}
    />
  );
}
