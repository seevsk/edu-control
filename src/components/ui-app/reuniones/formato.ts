import { minutosHasta, ventanaSala, type DatosEstadoReunion, type EstadoReunion as EstadoLogico } from "@/lib/estado-reunion";
import { duracionMinutos, fechaCorta, hora } from "@/lib/formato-fecha";
import { nombrePila } from "@/lib/nombres";
import type { VarianteEstado } from "./estado-reunion";

export type Respuesta = "pendiente" | "asistire" | "no_asistire";

export interface Asistente {
  idUsuario: number;
  respuesta: Respuesta;
  fechaEntrada: Date | null;
  usuario: { nombre: string; apellidos: string | null; fotoUrl: string | null };
}

export function rangoReunion(r: { inicio: Date; fin: Date }): string {
  return `${hora(r.inicio)} - ${hora(r.fin)}`;
}

/** Variante visual del estado calculado (spec P5 y resolución 7). */
export function varianteDeEstado(
  estado: EstadoLogico,
  r: DatosEstadoReunion,
  ahora: Date,
): { estado: VarianteEstado; minutos?: number; texto?: string } {
  switch (estado) {
    case "programada": {
      const minutos = minutosHasta(r.inicio, ahora);
      // "Empieza en N min" solo si faltan menos de 60 min; si no, la fecha relativa.
      return minutos < 60 ? { estado: "empieza", minutos } : { estado: "empieza", texto: fechaCorta(r.inicio, { ahora }) };
    }
    case "sala_abierta":
      return { estado: "sala_abierta" };
    case "en_curso":
      return { estado: "en_curso" };
    case "por_cerrar":
      return { estado: "por_cerrar", minutos: minutosHasta(ventanaSala(r.inicio, r.fin).cierre, ahora) };
    case "terminada":
      return { estado: "terminada" };
  }
}

/** Quien entró primero (su `fechaEntrada` es la más antigua), o `null`. */
export function quienInicio(asistentes: Asistente[]): Asistente | null {
  let primero: Asistente | null = null;
  for (const a of asistentes) {
    if (!a.fechaEntrada) continue;
    if (!primero || a.fechaEntrada < (primero.fechaEntrada as Date)) primero = a;
  }
  return primero;
}

export function entraron(asistentes: Asistente[]): Asistente[] {
  return asistentes
    .filter((a) => a.fechaEntrada)
    .sort((a, b) => (a.fechaEntrada as Date).getTime() - (b.fechaEntrada as Date).getTime());
}

export function nombreAsistente(a: Asistente): string {
  return nombrePila(a.usuario.nombre);
}

/** Resolución 1: "Iniciada por Valeria · hace 33 min" (< 60 min) o "… · desde 7:00pm"; en móvil sin "Iniciada por". */
export function lineaIniciada(nombre: string, desde: Date, ahora: Date, movil = false): string {
  const minutos = Math.max(0, Math.floor((ahora.getTime() - desde.getTime()) / 60_000));
  const cuando = minutos < 60 ? `hace ${minutos} min` : `desde ${hora(desde)}`;
  return `${movil ? "" : "Iniciada por "}${nombre} · ${cuando}`;
}

/** Resolución 14: conteo único de asistencia. */
export function conteoAsistencia(
  r: { videollamada: boolean; asistentes: Asistente[] },
  terminada: boolean,
): string {
  const confirmados = r.asistentes.filter((a) => a.respuesta === "asistire").length;
  if (!terminada) return `${confirmados} de ${r.asistentes.length} asistirán`;
  if (r.videollamada) {
    const entradas = entraron(r.asistentes).length;
    return entradas === 1 ? "1 entró" : `${entradas} entraron`;
  }
  return `${confirmados} de ${r.asistentes.length} ${confirmados === 1 ? "asistió" : "asistieron"}`;
}

export function duracionEntre(desde: Date, hasta: Date): string {
  return duracionMinutos(Math.max(1, Math.round((hasta.getTime() - desde.getTime()) / 60_000)));
}
