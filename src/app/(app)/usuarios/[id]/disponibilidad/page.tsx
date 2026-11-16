import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerHorarioCompanero } from "@/server/services/disponibilidad";
import { fechaEnZonaLimaISO } from "@/lib/calendario";
import { nombreCorto } from "@/lib/nombres";
import { PaginaCompleta } from "@/components/ui-app/page-header";
import { Migas } from "@/components/ui-app/barra-superior";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { CalendarioVista } from "../../../calendario/_components/calendario-vista";
import { construirEventosCompanero, minutosPorFiltro } from "../../../calendario/_components/eventos";
import type { ModoCalendario } from "../../../calendario/_components/tipos-calendario";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ modo?: string; fecha?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const sesion = await requerirSesion();
  const horario = Number.isInteger(Number(id)) ? await obtenerHorarioCompanero(sesion.idUsuario, Number(id)) : null;
  return { title: horario ? `Disponibilidad de ${nombreCorto(horario.nombre, horario.apellidos)}` : "Disponibilidad" };
}

/** Horario semanal de un compañero, con el mismo calendario que el propio (solo lectura). */
export default async function DisponibilidadCompaneroPage({ params, searchParams }: Props) {
  const { id } = await params;
  const idUsuario = Number(id);
  if (!Number.isInteger(idUsuario)) notFound();

  const sesion = await requerirSesion();
  const horario = await obtenerHorarioCompanero(sesion.idUsuario, idUsuario);
  if (!horario) notFound();

  const { modo: modoParam, fecha: fechaParam } = await searchParams;
  const hoyISO = fechaEnZonaLimaISO(new Date());
  const fecha = fechaParam && FECHA.test(fechaParam) ? fechaParam : hoyISO;
  const modo: ModoCalendario = modoParam === "mes" || modoParam === "agenda" ? modoParam : "semana";
  const eventos = construirEventosCompanero(horario);
  const nombre = nombreCorto(horario.nombre, horario.apellidos);
  const ruta = `/usuarios/${idUsuario}/disponibilidad`;

  return (
    <PaginaCompleta>
      <Migas items={[{ href: `/usuarios/${idUsuario}`, texto: nombre }, { texto: "Disponibilidad" }]} />
      <div className="px-4 py-5 sm:px-6">
        <div className="mb-5 flex items-center gap-3">
          <UserAvatar usuario={{ idUsuario, nombre: horario.nombre, apellidos: horario.apellidos, fotoUrl: horario.fotoUrl }} tamano="lg" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{nombre}</p>
            <p className="text-xs text-subtle-foreground">Horario semanal</p>
          </div>
        </div>
        <CalendarioVista eventos={eventos} minutos={minutosPorFiltro(eventos)} modo={modo} fecha={fecha} hoyISO={hoyISO} rutaBase={ruta} soloLectura />
      </div>
    </PaginaCompleta>
  );
}
