import type { obtenerSemanaCalendario } from "@/server/services/calendario";
import {
  categoriaDeTipoBloque,
  etiquetaMinutos,
  fechaEnZonaLimaISO,
  minutosDelDiaLima,
  partesPorDia,
  type CategoriaCalendario,
} from "@/lib/calendario";

type SemanaCalendario = Awaited<ReturnType<typeof obtenerSemanaCalendario>>;

export const ETIQUETA_TIPO_BLOQUE = {
  laboral: "Laboral",
  familiar: "Familiar",
  personal: "Personal",
} as const;

const ETIQUETA_MODALIDAD = { presencial: "Presencial", remoto: "Remoto" } as const;

/** Clases de Tailwind por categoria (cadenas completas para que Tailwind las detecte). */
export const ESTILO_CATEGORIA: Record<CategoriaCalendario, { punto: string; bloque: string; enlace: string }> = {
  clases: {
    punto: "bg-cat-clases",
    bloque: "border-cat-clases-borde bg-cat-clases-bg text-cat-clases-fg",
    enlace: "hover:border-cat-clases",
  },
  laboral: {
    punto: "bg-cat-laboral",
    bloque: "border-cat-laboral-borde bg-cat-laboral-bg text-cat-laboral-fg",
    enlace: "hover:border-cat-laboral",
  },
  fam: {
    punto: "bg-cat-fam",
    bloque: "border-cat-fam-borde bg-cat-fam-bg text-cat-fam-fg",
    enlace: "hover:border-cat-fam",
  },
};

export type ItemCalendario = {
  clave: string;
  categoria: CategoriaCalendario;
  diaSemana: number;
  /** Posicion de esta parte dentro del dia (0-1440). */
  inicioMin: number;
  finMin: number;
  /** Horas reales del bloque completo ("9:30 PM", "8:30 AM"), iguales en las dos partes. */
  horaInicio: string;
  horaFin: string;
  sigueDelDiaAnterior: boolean;
  sigueAlDiaSiguiente: boolean;
  titulo: string;
  subtitulo: string | null;
  /** Clases: enlace al curso. Bloques: enlace a su pagina de edicion. null = solo lectura (horario de otro). */
  href: string | null;
};

export type Entrega = {
  clave: string;
  diaISO: string;
  tipo: "evaluacion" | "tarea";
  titulo: string;
  contexto: string;
  hora: string;
  href: string;
};

function etiquetaHora(hora: Date) {
  return etiquetaMinutos(hora.getUTCHours() * 60 + hora.getUTCMinutes());
}

export function rangoDe(item: ItemCalendario) {
  return `${item.horaInicio} – ${item.horaFin}`;
}

export function construirItems(
  horarios: SemanaCalendario["horarios"],
  bloques: SemanaCalendario["bloquesOcupados"],
  /** "?semana=...&vista=..." para que al editar se vuelva a la misma semana y pestaña. */
  consulta: string,
): ItemCalendario[] {
  const items: ItemCalendario[] = [];

  for (const horario of horarios) {
    partesPorDia(horario.diaSemana, horario.horaInicio, horario.horaFin).forEach((parte, i) => {
      items.push({
        ...parte,
        clave: `h-${horario.idHorario}-${i}`,
        categoria: "clases",
        horaInicio: etiquetaHora(horario.horaInicio),
        horaFin: etiquetaHora(horario.horaFin),
        titulo: horario.curso.nombre,
        subtitulo: horario.curso.modalidad ? ETIQUETA_MODALIDAD[horario.curso.modalidad] : null,
        href: `/cursos/${horario.curso.idCurso}`,
      });
    });
  }

  for (const bloque of bloques) {
    // Con detalle, el detalle es lo que se reconoce de un vistazo ("Turno en la tienda").
    const tipo = ETIQUETA_TIPO_BLOQUE[bloque.tipo];
    partesPorDia(bloque.diaSemana, bloque.horaInicio, bloque.horaFin).forEach((parte, i) => {
      items.push({
        ...parte,
        clave: `b-${bloque.idBloqueOcupado}-${i}`,
        categoria: categoriaDeTipoBloque(bloque.tipo),
        horaInicio: etiquetaHora(bloque.horaInicio),
        horaFin: etiquetaHora(bloque.horaFin),
        titulo: bloque.detalle ?? tipo,
        subtitulo: bloque.detalle ? tipo : null,
        href: `/calendario/bloques/${bloque.idBloqueOcupado}${consulta}`,
      });
    });
  }

  return items;
}

/**
 * Horario de un companero, de solo lectura: clases con su curso y bloques solo con su
 * categoria (nunca el detalle, que es texto libre y puede ser personal).
 */
export function construirItemsCompanero(horario: {
  horarios: { idHorario: number; diaSemana: number; horaInicio: Date; horaFin: Date; curso: string }[];
  bloques: { idBloqueOcupado: number; categoria: CategoriaCalendario; diaSemana: number; horaInicio: Date; horaFin: Date }[];
}): ItemCalendario[] {
  const etiquetaCategoria = { clases: "Clases", laboral: "Laboral", fam: "Familiar / Personal" } as const;
  return [
    ...horario.horarios.flatMap((h) =>
      partesPorDia(h.diaSemana, h.horaInicio, h.horaFin).map((parte, i) => ({
        ...parte,
        clave: `h-${h.idHorario}-${i}`,
        categoria: "clases" as const,
        horaInicio: etiquetaHora(h.horaInicio),
        horaFin: etiquetaHora(h.horaFin),
        titulo: h.curso,
        subtitulo: null,
        href: null,
      })),
    ),
    ...horario.bloques.flatMap((b) =>
      partesPorDia(b.diaSemana, b.horaInicio, b.horaFin).map((parte, i) => ({
        ...parte,
        clave: `b-${b.idBloqueOcupado}-${i}`,
        categoria: b.categoria,
        horaInicio: etiquetaHora(b.horaInicio),
        horaFin: etiquetaHora(b.horaFin),
        titulo: etiquetaCategoria[b.categoria],
        subtitulo: null,
        href: null,
      })),
    ),
  ];
}

export function construirEntregas(
  evaluaciones: SemanaCalendario["evaluaciones"],
  tareas: SemanaCalendario["tareas"],
): Entrega[] {
  return [
    ...evaluaciones.map((e) => ({
      clave: `e-${e.idEvaluacion}`,
      diaISO: fechaEnZonaLimaISO(e.fechaCierre),
      tipo: "evaluacion" as const,
      titulo: e.nombre,
      contexto: e.curso.nombre,
      hora: etiquetaMinutos(minutosDelDiaLima(e.fechaCierre)),
      href: `/cursos/${e.idCurso}`,
    })),
    ...tareas.flatMap((t) =>
      t.fechaLimite
        ? [
            {
              clave: `t-${t.idTarea}`,
              diaISO: fechaEnZonaLimaISO(t.fechaLimite),
              tipo: "tarea" as const,
              titulo: t.titulo,
              contexto: t.grupo.nombre,
              hora: etiquetaMinutos(minutosDelDiaLima(t.fechaLimite)),
              href: `/grupos/${t.idGrupo}/tareas`,
            },
          ]
        : [],
    ),
  ];
}
