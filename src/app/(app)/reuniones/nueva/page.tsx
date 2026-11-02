import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { gruposParaProgramar, reunionesDelGrupoEntre } from "@/server/services/reunion";
import { obtenerDisponibilidadGrupo } from "@/server/services/disponibilidad";
import {
  DIAS_CORTOS,
  DIAS_LARGOS,
  diaSemanaISO,
  etiquetaMinutos,
  fechaEnZonaLimaISO,
  minutosDelDiaLima,
  proximaFechaDelDia,
  sumarDiasISO,
} from "@/lib/calendario";
import { bloquearReunionesParaTodos, huecos, mapaDeDisponibilidad, type Franja } from "@/lib/disponibilidad";
import { MapaSemanal } from "@/components/mapa-semanal";
import { FormularioReunion, type Sugerencia } from "./formulario-reunion";

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function hhmm(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function nivelDeFranja(libres: number, total: number) {
  if (libres === total) return "bg-estado-completada/15 text-estado-completada";
  if (libres / total >= 0.5) return "bg-estado-completada/25 text-estado-completada";
  if (libres > 0) return "bg-estado-revision/20 text-estado-revision";
  return "bg-border-strong/35 text-text-muted";
}

export default async function NuevaReunionPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string; fecha?: string; inicio?: string; fin?: string; error?: string }>;
}) {
  const sesion = await requerirSesion();
  const { grupo, fecha, inicio, fin, error } = await searchParams;
  const grupos = await gruposParaProgramar(sesion.idUsuario);
  const idGrupo =
    grupos.find((g) => g.idGrupo === Number(grupo))?.idGrupo ?? (grupos.length === 1 ? grupos[0].idGrupo : null);

  const ahora = new Date();
  const hoyISO = fechaEnZonaLimaISO(ahora);
  const ahoraMin = minutosDelDiaLima(ahora);

  const finPeriodoISO = sumarDiasISO(hoyISO, 7);
  const desdePeriodo = new Date(`${hoyISO}T00:00:00-05:00`);
  const hastaPeriodo = new Date(`${finPeriodoISO}T00:00:00-05:00`);
  const [integrantesBase, reuniones] = idGrupo
    ? await Promise.all([
        obtenerDisponibilidadGrupo(sesion.idUsuario, idGrupo),
        reunionesDelGrupoEntre(sesion.idUsuario, idGrupo, desdePeriodo, hastaPeriodo),
      ])
    : [[], []];
  const integrantesConReuniones = bloquearReunionesParaTodos(integrantesBase, reuniones);
  const total = integrantesBase.length;
  const nombres = new Map(integrantesBase.map((i) => [i.idUsuario, i.idUsuario === sesion.idUsuario ? "ti" : i.nombre]));
  const mapa = idGrupo ? mapaDeDisponibilidad(integrantesConReuniones) : null;
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

  let sugerencias: Sugerencia[] = [];
  if (mapa) {
    const comunes = huecos(mapa);
    const base = comunes.length > 0 ? comunes : total > 2 ? huecos(mapa, { toleranciaFaltantes: 1 }) : [];
    sugerencias = base
      .map((hueco): Sugerencia | null => {
        const dia = proximaFechaDelDia(hoyISO, hueco.diaSemana);
        const desde = dia === hoyISO ? Math.max(hueco.inicioMin, Math.ceil((ahoraMin + 1) / 30) * 30) : hueco.inicioMin;
        if (desde + 60 > hueco.finMin) return null;
        return {
          fecha: dia,
          inicio: hhmm(desde),
          fin: hhmm(desde + 60),
          etiqueta: `${DIAS_CORTOS[hueco.diaSemana - 1]} ${Number(dia.slice(8))} · ${etiquetaMinutos(desde)} – ${etiquetaMinutos(desde + 60)}`,
          faltan: hueco.faltan.map((id) => nombres.get(id) ?? "").join(", ") || null,
        };
      })
      .filter((sugerencia): sugerencia is Sugerencia => sugerencia !== null)
      .sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio))
      .slice(0, 8);
  }

  const describirFranja = (franja: Franja) => {
    const libres = total - franja.ocupados.length;
    const faltan = franja.ocupados.map((id) => nombres.get(id)).join(", ");
    return `${DIAS_LARGOS[franja.diaSemana - 1]} ${etiquetaMinutos(franja.inicioMin)} – ${etiquetaMinutos(franja.finMin)} · ${
      libres === total ? "todos libres" : `${libres} de ${total} libres · falta ${faltan}`
    }`;
  };

  return (
    <div className="animate-page-in mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <Link href="/reuniones" className="text-sm text-primary hover:underline">
          Reuniones
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Programar reunión</h1>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {grupos.length === 0 ? (
        <p className="rounded-md border border-border bg-surface px-4 py-5 text-sm text-text-muted">
          Sin grupos activos donde programar.
        </p>
      ) : (
        <FormularioReunion
          key={idGrupo ?? "sin-grupo"}
          grupos={grupos}
          idGrupo={idGrupo}
          hoyISO={hoyISO}
          integrantes={integrantesBase.map((i) => ({ idUsuario: i.idUsuario, nombre: nombres.get(i.idUsuario) ?? i.nombre, ocupados: i.ocupados }))}
          reunionesProgramadas={reuniones.map((reunion) => ({
            titulo: reunion.titulo,
            fecha: fechaEnZonaLimaISO(reunion.inicio),
            inicioMin: minutosDelDiaLima(reunion.inicio),
            finMin: minutosDelDiaLima(reunion.fin),
          }))}
          sugerencias={sugerencias}
          iniciales={{
            fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= hoyISO ? fecha : "",
            inicio: inicio && HORA.test(inicio) ? inicio : "18:00",
            fin: fin && HORA.test(fin) ? fin : "19:00",
          }}
        />
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
