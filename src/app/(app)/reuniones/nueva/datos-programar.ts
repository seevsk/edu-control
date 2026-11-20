import { reunionesDelGrupoEntre } from "@/server/services/reunion";
import { obtenerDisponibilidadGrupo } from "@/server/services/disponibilidad";
import {
  DIAS_CORTOS,
  etiquetaMinutos,
  fechaEnZonaLimaISO,
  minutosDelDiaLima,
  proximaFechaDelDia,
  sumarDiasISO,
} from "@/lib/calendario";
import { bloquearReunionesParaTodos, huecos, mapaDeDisponibilidad } from "@/lib/disponibilidad";
import type { Sugerencia } from "./formulario-reunion";

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function hhmm(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

export type ParametrosProgramar = {
  fecha?: string;
  inicio?: string;
  fin?: string;
  titulo?: string;
  lugar?: string;
};

/** Valores precargados desde la URL (huecos de Horarios, reintento tras un error): todo se revalida. */
export function inicialesDeParametros(parametros: ParametrosProgramar, hoyISO: string) {
  const { fecha, inicio, fin, titulo, lugar } = parametros;
  return {
    fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= hoyISO ? fecha : "",
    inicio: inicio && HORA.test(inicio) ? inicio : "18:00",
    fin: fin && HORA.test(fin) ? fin : "19:00",
    titulo: (titulo ?? "").slice(0, 120),
    lugar: (lugar ?? "").slice(0, 160),
  };
}

/** Disponibilidad, reuniones de los próximos 7 días y sugerencias de un grupo (verifica membresía en el servicio). */
export async function cargarDatosProgramar(idUsuario: number, idGrupo: number | null) {
  const ahora = new Date();
  const hoyISO = fechaEnZonaLimaISO(ahora);
  const ahoraMin = minutosDelDiaLima(ahora);

  const finPeriodoISO = sumarDiasISO(hoyISO, 7);
  const desdePeriodo = new Date(`${hoyISO}T00:00:00-05:00`);
  const hastaPeriodo = new Date(`${finPeriodoISO}T00:00:00-05:00`);
  const [integrantesBase, reuniones] = idGrupo
    ? await Promise.all([
        obtenerDisponibilidadGrupo(idUsuario, idGrupo),
        reunionesDelGrupoEntre(idUsuario, idGrupo, desdePeriodo, hastaPeriodo),
      ])
    : [[], []];
  const integrantesConReuniones = bloquearReunionesParaTodos(integrantesBase, reuniones);
  const total = integrantesBase.length;
  const nombres = new Map(integrantesBase.map((i) => [i.idUsuario, i.idUsuario === idUsuario ? "ti" : i.nombre]));
  const mapa = idGrupo ? mapaDeDisponibilidad(integrantesConReuniones) : null;

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
          etiqueta: `${DIAS_CORTOS[hueco.diaSemana - 1]} ${Number(dia.slice(8))} · ${etiquetaMinutos(desde)} - ${etiquetaMinutos(desde + 60)}`,
          faltan: hueco.faltan.map((id) => nombres.get(id) ?? "").join(", ") || null,
        };
      })
      .filter((sugerencia): sugerencia is Sugerencia => sugerencia !== null)
      .sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio))
      .slice(0, 8);
  }

  return {
    hoyISO,
    ahoraMin,
    integrantesBase,
    reuniones,
    total,
    nombres,
    mapa,
    sugerencias,
    integrantes: integrantesBase.map((i) => ({ idUsuario: i.idUsuario, nombre: nombres.get(i.idUsuario) ?? i.nombre, ocupados: i.ocupados })),
    reunionesProgramadas: reuniones.map((reunion) => ({
      titulo: reunion.titulo,
      fecha: fechaEnZonaLimaISO(reunion.inicio),
      inicioMin: minutosDelDiaLima(reunion.inicio),
      finMin: minutosDelDiaLima(reunion.fin),
    })),
  };
}
