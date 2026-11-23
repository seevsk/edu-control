/**
 * Estado de una reunion, siempre calculado (nunca guardado). Funciones puras, sin Prisma ni Next.
 * Con videollamada la sala abre 10 min antes del inicio y cierra 15 min despues del fin.
 */
import { fechaEnZonaLimaISO } from "./calendario";
import { finDeDiaLimaAUtc } from "./dates";

export const APERTURA_MIN = 10;
export const CIERRE_MIN = 15;
export const AVISO_CIERRE_MIN = 5;
export const DURACION_INMEDIATA_MIN = 60;
/** Cuanto espera el cierre perezoso antes de dar por abandonada una sala vacia (alguien puede estar entrando). */
export const GRACIA_SALA_VACIA_MIN = 5;

const MS_MIN = 60_000;

export type EstadoReunion = "programada" | "sala_abierta" | "en_curso" | "por_cerrar" | "terminada";

export interface DatosEstadoReunion {
  inicio: Date;
  fin: Date;
  videollamada: boolean;
  iniciadaEn: Date | null;
  finalizadaEn: Date | null;
}

export function ventanaSala(inicio: Date, fin: Date): { apertura: Date; cierre: Date } {
  return {
    apertura: new Date(inicio.getTime() - APERTURA_MIN * MS_MIN),
    cierre: new Date(fin.getTime() + CIERRE_MIN * MS_MIN),
  };
}

export function estadoReunion(r: DatosEstadoReunion, ahora: Date): EstadoReunion {
  // Sin videollamada no hay sala: solo existe "programada" hasta el fin.
  if (!r.videollamada) return ahora >= r.fin ? "terminada" : "programada";

  const { apertura, cierre } = ventanaSala(r.inicio, r.fin);
  if (r.finalizadaEn || ahora >= cierre) return "terminada";
  if (ahora < apertura) return "programada";
  if (ahora.getTime() >= cierre.getTime() - AVISO_CIERRE_MIN * MS_MIN) return "por_cerrar";
  if (r.iniciadaEn) return "en_curso";
  return "sala_abierta";
}

export function salaAbierta(estado: EstadoReunion): boolean {
  return estado === "sala_abierta" || estado === "en_curso" || estado === "por_cerrar";
}

/** Minutos que faltan hasta `fecha`, redondeando hacia arriba; nunca negativo. */
export function minutosHasta(fecha: Date, ahora: Date): number {
  return Math.max(0, Math.ceil((fecha.getTime() - ahora.getTime()) / MS_MIN));
}

export function etiquetaEstado(estado: EstadoReunion, r: Pick<DatosEstadoReunion, "inicio" | "fin">, ahora: Date): string {
  switch (estado) {
    case "programada":
      return `Empieza en ${minutosHasta(r.inicio, ahora)} min`;
    case "sala_abierta":
      return "Sala abierta";
    case "en_curso":
      return "En curso";
    case "por_cerrar":
      return `Cierra en ${minutosHasta(ventanaSala(r.inicio, r.fin).cierre, ahora)} min`;
    case "terminada":
      return "Terminada";
  }
}

/** Datos para decidir cierres y reaperturas: suma quien finalizo (`null` = se cerro sola). */
export interface DatosCierreReunion extends DatosEstadoReunion {
  idFinalizador: number | null;
}

/**
 * Una reunion que se cerro sola por sala vacia (sin finalizador y antes del cierre de la ventana)
 * se reabre si alguien pulsa Unirse mientras la ventana siga vigente. Si la finalizo un moderador,
 * o si `finalizadaEn >= cierre` (cierre por horario, que tambien deja `idFinalizador` en null),
 * sigue terminada.
 */
export function puedeReabrirse(r: DatosCierreReunion, ahora: Date): boolean {
  if (!r.videollamada || !r.finalizadaEn || r.idFinalizador !== null) return false;
  const { cierre } = ventanaSala(r.inicio, r.fin);
  return r.finalizadaEn < cierre && ahora < cierre;
}

/** Para mostrar: una reunion reabrible se ve como no finalizada (con "Unirse"). */
export function comoVigente<T extends DatosCierreReunion>(r: T, ahora: Date, grupoActivo = true): T {
  return grupoActivo && puedeReabrirse(r, ahora) ? { ...r, finalizadaEn: null } : r;
}

export type AccionSalaVacia = "ninguna" | "limpiar_inicio" | "finalizar";

/**
 * Que hacer con una reunion iniciada cuya sala quedo vacia. Antes de la hora de inicio (la sala abre
 * 10 min antes) no termina: solo se limpia `iniciadaEn` y vuelve a "sala abierta".
 */
export function accionSalaVacia(r: DatosEstadoReunion, ahora: Date): AccionSalaVacia {
  if (!r.videollamada || r.finalizadaEn || !r.iniciadaEn) return "ninguna";
  if (!salaAbierta(estadoReunion(r, ahora))) return "ninguna";
  return ahora < r.inicio ? "limpiar_inicio" : "finalizar";
}

export function debeFinalizarPorSalaVacia(r: DatosEstadoReunion, ahora: Date): boolean {
  return accionSalaVacia(r, ahora) === "finalizar";
}

/** Hasta cuando ocupa tiempo una reunion: una cerrada antes de su fin libera el resto; cerrada antes de su inicio, nada (`null`). */
export function intervaloOcupado(r: { inicio: Date; fin: Date; finalizadaEn: Date | null }): { inicio: Date; fin: Date } | null {
  const fin = r.finalizadaEn && r.finalizadaEn < r.fin ? r.finalizadaEn : r.fin;
  return fin > r.inicio ? { inicio: r.inicio, fin } : null;
}

/**
 * Rango de "Reunirse ahora": empieza en el minuto actual y dura 1 h, pero nunca cruza la medianoche
 * de Lima (fin <= 23:59). En el ultimo minuto del dia el inicio se adelanta a 23:58 para conservar
 * inicio < fin dentro del mismo dia.
 */
export function rangoReunirseAhora(ahora: Date): { inicio: Date; fin: Date } {
  const finDia = finDeDiaLimaAUtc(fechaEnZonaLimaISO(ahora));
  const minuto = new Date(Math.floor(ahora.getTime() / MS_MIN) * MS_MIN);
  const maxInicio = new Date(finDia.getTime() - MS_MIN);
  const inicio = minuto > maxInicio ? maxInicio : minuto;
  const fin = new Date(Math.min(inicio.getTime() + DURACION_INMEDIATA_MIN * MS_MIN, finDia.getTime()));
  return { inicio, fin };
}
