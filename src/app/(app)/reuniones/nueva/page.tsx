import type { Metadata } from "next";
import { requerirSesion } from "@/server/auth/session";
import { gruposParaProgramar } from "@/server/services/reunion";
import {
  DIAS_LARGOS,
  diaSemanaISO,
  etiquetaMinutos,
  fechaEnZonaLimaISO,
  minutosDelDiaLima,
  proximaFechaDelDia,
} from "@/lib/calendario";
import type { Franja } from "@/lib/disponibilidad";
import { Migas } from "@/components/ui-app/barra-superior";
import { VolverMovil } from "@/components/ui-app/page-header";
import { MapaSemanal } from "@/components/mapa-semanal";
import { FormularioReunion } from "./formulario-reunion";
import { RedirigirAHojaEnMovil } from "./redirigir-a-hoja";
import { cargarDatosProgramar, inicialesDeParametros } from "./datos-programar";

export const metadata: Metadata = { title: "Programar reunión" };

function nivelDeFranja(libres: number, total: number) {
  if (libres === total) return "bg-estado-completada/15 text-estado-completada";
  if (libres / total >= 0.5) return "bg-estado-completada/25 text-estado-completada";
  if (libres > 0) return "bg-estado-revision/20 text-estado-revision";
  return "bg-border-strong/35 text-text-muted";
}

export default async function NuevaReunionPage({
  searchParams,
}: {
  searchParams: Promise<{
    grupo?: string;
    fecha?: string;
    inicio?: string;
    fin?: string;
    titulo?: string;
    lugar?: string;
    sala?: string;
    error?: string;
  }>;
}) {
  const sesion = await requerirSesion();
  const { grupo, fecha, inicio, fin, titulo, lugar, sala, error } = await searchParams;
  const grupos = await gruposParaProgramar(sesion.idUsuario);
  const idGrupo =
    grupos.find((g) => g.idGrupo === Number(grupo))?.idGrupo ?? (grupos.length === 1 ? grupos[0].idGrupo : null);

  const { hoyISO, ahoraMin, reuniones, total, nombres, mapa, sugerencias, integrantes, reunionesProgramadas } =
    await cargarDatosProgramar(sesion.idUsuario, idGrupo);
  const fechasDias = Array.from({ length: 7 }, (_, indice) => proximaFechaDelDia(hoyISO, indice + 1));
  const eventosMapa = reuniones.map((reunion) => ({
    clave: `reunion-${reunion.idReunion}`,
    diaSemana: diaSemanaISO(fechaEnZonaLimaISO(reunion.inicio)),
    inicioMin: minutosDelDiaLima(reunion.inicio),
    finMin: minutosDelDiaLima(reunion.fin),
    titulo: reunion.titulo,
    subtitulo: reunion.lugar,
    href: `/reuniones?grupo=${idGrupo}#reunion-${reunion.idReunion}`,
  }));

  const describirFranja = (franja: Franja) => {
    const libres = total - franja.ocupados.length;
    const faltan = franja.ocupados.map((id) => nombres.get(id)).join(", ");
    return `${DIAS_LARGOS[franja.diaSemana - 1]} ${etiquetaMinutos(franja.inicioMin)} - ${etiquetaMinutos(franja.finMin)} · ${
      libres === total ? "todos libres" : `${libres} de ${total} libres · falta ${faltan}`
    }`;
  };

  return (
    <div className="animate-page-in mx-auto flex max-w-4xl flex-col gap-5 lg:pt-4">
      {idGrupo ? <RedirigirAHojaEnMovil idGrupo={idGrupo} parametros={{ fecha, inicio, fin, titulo, lugar, sala, error }} /> : null}
      <Migas items={[{ href: "/reuniones", texto: "Reuniones" }, { texto: "Programar" }]} />
      <div>
        <VolverMovil href="/reuniones" texto="Reuniones" className="-mt-2" />
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.02em]">Programar reunión</h1>
      </div>

      {error && sala !== "error" ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {grupos.length === 0 ? (
        <p className="rounded-md border border-border bg-surface px-4 py-5 text-sm text-text-muted">
          Sin grupos activos donde programar.
        </p>
      ) : (
        <div className="w-full max-w-[640px] self-center">
        <FormularioReunion
          key={idGrupo ?? "sin-grupo"}
          grupos={grupos}
          idGrupo={idGrupo}
          hoyISO={hoyISO}
          integrantes={integrantes}
          reunionesProgramadas={reunionesProgramadas}
          sugerencias={sugerencias}
          iniciales={inicialesDeParametros({ fecha, inicio, fin, titulo, lugar }, hoyISO)}
          errorSala={sala === "error"}
        />
        </div>
      )}

      {mapa ? (
        <MapaSemanal
          etiqueta="Disponibilidad del grupo durante los próximos 7 días"
          titulo="Disponibilidad de los próximos 7 días"
          descripcion="Las reuniones ya programadas aparecen como horas ocupadas y no se ofrecen nuevamente como sugerencias."
          fechasDias={fechasDias}
          hoyISO={hoyISO}
          ahoraMin={ahoraMin}
          eventos={eventosMapa}
          mapa={mapa}
          claseDeFranja={(franja) => nivelDeFranja(total - franja.ocupados.length, total)}
          describirFranja={describirFranja}
          leyenda={[
            { clase: "bg-estado-completada/30", texto: "Todos libres" },
            { clase: "bg-estado-completada/45", texto: "La mayoría" },
            { clase: "bg-estado-revision/30", texto: "Algunos" },
            { clase: "bg-border-strong/50", texto: "Nadie" },
            ...(reuniones.length > 0 ? [{ clase: "bg-cat-reunion", texto: "Reunión programada" }] : []),
          ]}
        />
      ) : null}
    </div>
  );
}
