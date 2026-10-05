/**
 * Disponibilidad comun de un grupo, calculada (nunca guardada, AGENTS.md 8.5). Trabaja sobre la
 * semana tipo: minutos desde el lunes 00:00 (0) hasta el domingo 24:00 (10080). Solo maneja
 * ocupado/libre: el tipo de bloque o el curso nunca llegan hasta aqui (AGENTS.md 8.2).
 */
const MIN_DIA = 24 * 60;
const MIN_SEMANA = 7 * MIN_DIA;

export type Intervalo = [inicio: number, fin: number];

export type PatronSemanal = { diaSemana: number; horaInicio: Date; horaFin: Date };

function minutosDelTime(hora: Date) {
  return hora.getUTCHours() * 60 + hora.getUTCMinutes();
}

/**
 * Patron semanal -> intervalos en minutos de la semana. Si cruza la medianoche termina al dia
 * siguiente; si es el domingo, la parte despues de la medianoche cae en el lunes (es la semana tipo).
 */
export function intervalosDeLaSemana(patrones: PatronSemanal[]): Intervalo[] {
  const intervalos: Intervalo[] = [];
  for (const patron of patrones) {
    const base = (patron.diaSemana - 1) * MIN_DIA;
    const inicio = base + minutosDelTime(patron.horaInicio);
    let fin = base + minutosDelTime(patron.horaFin);
    if (fin <= inicio) fin += MIN_DIA;

    if (fin <= MIN_SEMANA) {
      intervalos.push([inicio, fin]);
    } else {
      intervalos.push([inicio, MIN_SEMANA], [0, fin - MIN_SEMANA]);
    }
  }
  return intervalos;
}

export type Integrante = { idUsuario: number; ocupados: Intervalo[] };

export type Franja = {
  diaSemana: number;
  /** Minutos desde la medianoche del dia. */
  inicioMin: number;
  finMin: number;
  /** Quienes estan ocupados en al menos parte de la franja. */
  ocupados: number[];
};

export const VENTANA_POR_DEFECTO = { desdeMin: 7 * 60, hastaMin: 23 * 60, pasoMin: 30 };

/** Franjas de `pasoMin` dentro de la ventana diaria, por cada dia de la semana (7 listas). */
export function mapaDeDisponibilidad(integrantes: Integrante[], ventana = VENTANA_POR_DEFECTO): Franja[][] {
  return Array.from({ length: 7 }, (_, i) => {
    const diaSemana = i + 1;
    const base = i * MIN_DIA;
    const franjas: Franja[] = [];
    for (let inicioMin = ventana.desdeMin; inicioMin < ventana.hastaMin; inicioMin += ventana.pasoMin) {
      const finMin = Math.min(inicioMin + ventana.pasoMin, ventana.hastaMin);
      const desde = base + inicioMin;
      const hasta = base + finMin;
      const ocupados = integrantes
        .filter((integrante) => integrante.ocupados.some(([a, b]) => a < hasta && b > desde))
        .map((integrante) => integrante.idUsuario);
      franjas.push({ diaSemana, inicioMin, finMin, ocupados });
    }
    return franjas;
  });
}

export type Hueco = { diaSemana: number; inicioMin: number; finMin: number; faltan: number[] };

/**
 * Franjas consecutivas donde estan libres todos menos, a lo sumo, `toleranciaFaltantes`
 * personas (siempre las mismas), de al menos `minimoMin` minutos.
 */
export function huecos(mapa: Franja[][], { minimoMin = 60, toleranciaFaltantes = 0 } = {}): Hueco[] {
  const resultado: Hueco[] = [];

  for (const franjas of mapa) {
    let actual: Hueco | null = null;
    const cerrar = () => {
      if (actual && actual.finMin - actual.inicioMin >= minimoMin) resultado.push(actual);
      actual = null;
    };

    for (const franja of franjas) {
      const cabe = franja.ocupados.length <= toleranciaFaltantes;
      const mismaGente =
        actual !== null &&
        actual.finMin === franja.inicioMin &&
        actual.faltan.length === franja.ocupados.length &&
        actual.faltan.every((id) => franja.ocupados.includes(id));

      if (cabe && mismaGente && actual) {
        actual.finMin = franja.finMin;
      } else {
        cerrar();
        if (cabe) {
          actual = { diaSemana: franja.diaSemana, inicioMin: franja.inicioMin, finMin: franja.finMin, faltan: [...franja.ocupados] };
        }
      }
    }
    cerrar();
  }

  return resultado;
}

/** Dias en los que nadie tiene nada dentro de la ventana. */
export function diasLibresParaTodos(mapa: Franja[][]): number[] {
  return mapa
    .filter((franjas) => franjas.length > 0 && franjas.every((franja) => franja.ocupados.length === 0))
    .map((franjas) => franjas[0].diaSemana);
}
