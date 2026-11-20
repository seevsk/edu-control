/**
 * Estado de una reunion, siempre calculado (nunca guardado). Funciones puras, sin Prisma ni Next.
 * Con videollamada la sala abre 10 min antes del inicio y cierra 15 min despues del fin.
 */
export const APERTURA_MIN = 10;
export const CIERRE_MIN = 15;
export const AVISO_CIERRE_MIN = 5;
export const DURACION_INMEDIATA_MIN = 60;

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
