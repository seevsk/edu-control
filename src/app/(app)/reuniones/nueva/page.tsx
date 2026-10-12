import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { gruposParaProgramar } from "@/server/services/reunion";
import { obtenerDisponibilidadGrupo } from "@/server/services/disponibilidad";
import {
  DIAS_CORTOS,
  DIAS_LARGOS,
  etiquetaMinutos,
  fechaEnZonaLimaISO,
  minutosDelDiaLima,
  proximaFechaDelDia,
  sumarDiasISO,
} from "@/lib/calendario";
import { huecos, mapaDeDisponibilidad, type Franja } from "@/lib/disponibilidad";
import { MapaSemanal } from "@/components/mapa-semanal";
import { FormularioReunion, type Sugerencia } from "./formulario-reunion";

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function hhmm(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function nivelDeFranja(libres: number, total: number) {
  if (libres === total) return "bg-estado-completada";
  if (libres / total >= 0.5) return "bg-estado-completada/45";
  if (libres > 0) return "bg-estado-completada/15";
  return "bg-border";
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

  const integrantes = idGrupo ? await obtenerDisponibilidadGrupo(sesion.idUsuario, idGrupo) : [];
  const total = integrantes.length;
  const nombres = new Map(integrantes.map((i) => [i.idUsuario, i.idUsuario === sesion.idUsuario ? "ti" : i.nombre]));
  const mapa = idGrupo ? mapaDeDisponibilidad(integrantes) : null;

  let sugerencias: Sugerencia[] = [];
  if (mapa) {
    const comunes = huecos(mapa);
    const base = comunes.length > 0 ? comunes : total > 2 ? huecos(mapa, { toleranciaFaltantes: 1 }) : [];
    sugerencias = base
      .map((hueco) => {
        let dia = proximaFechaDelDia(hoyISO, hueco.diaSemana);
        if (dia === hoyISO && hueco.finMin <= ahoraMin + 30) dia = sumarDiasISO(dia, 7);
        const desde = dia === hoyISO ? Math.max(hueco.inicioMin, Math.ceil((ahoraMin + 1) / 30) * 30) : hueco.inicioMin;
        return {
          fecha: dia,
          inicio: hhmm(desde),
          fin: hhmm(Math.min(desde + 60, hueco.finMin)),
          etiqueta: `${DIAS_CORTOS[hueco.diaSemana - 1]} ${Number(dia.slice(8))} · ${etiquetaMinutos(desde)} – ${etiquetaMinutos(hueco.finMin)}`,
          faltan: hueco.faltan.map((id) => nombres.get(id) ?? "").join(", ") || null,
        };
      })
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
          integrantes={integrantes.map((i) => ({ idUsuario: i.idUsuario, nombre: nombres.get(i.idUsuario) ?? i.nombre, ocupados: i.ocupados }))}
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
          etiqueta="Disponibilidad semanal del grupo"
          mapa={mapa}
          claseDeFranja={(franja) => nivelDeFranja(total - franja.ocupados.length, total)}
          describirFranja={describirFranja}
          leyenda={[
            { clase: "bg-estado-completada", texto: "Todos libres" },
            { clase: "bg-estado-completada/45", texto: "La mayoría" },
            { clase: "bg-estado-completada/15", texto: "Algunos" },
            { clase: "bg-border", texto: "Nadie" },
          ]}
        />
      ) : null}
    </div>
  );
}
