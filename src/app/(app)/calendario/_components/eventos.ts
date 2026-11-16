import type { obtenerCalendarioEntre } from "@/server/services/calendario";
import type { CalendarEvent } from "@/components/reui/event-calendar/event-calendar-types";
import { DIAS_LARGOS, fechaEnZonaLimaISO, minutosDelDiaLima, sumarDiasISO } from "@/lib/calendario";
import { aOracion, colorCurso } from "@/lib/presentacion";
import { formatoTitulo } from "@/lib/nombres";
import { diaYMes, fechaCorta, formatoHora, rangoHoras } from "@/lib/formato-fecha";
import type { DatoEvento, FiltroCalendario } from "./tipos-calendario";

type DatosCalendario = Awaited<ReturnType<typeof obtenerCalendarioEntre>>;
export type EventoCalendario = CalendarEvent<DatoEvento>;

const ETIQUETA_MODALIDAD = { presencial: "Presencial", remoto: "Remoto" } as const;
const ETIQUETA_BLOQUE = { laboral: "Laboral", familiar: "Familiar", personal: "Personal" } as const;
const COLOR_BLOQUE = { laboral: "var(--cat-laboral)", familiar: "var(--cat-fam)", personal: "var(--cal-personal)" } as const;
/** Lunes de referencia para anclar los patrones semanales; la recurrencia los repite cada semana. */
const LUNES_ANCLA = "2024-01-01";

const dosDigitos = (valor: number) => String(valor).padStart(2, "0");
const minutosDeTime = (time: Date) => time.getUTCHours() * 60 + time.getUTCMinutes();
const partes = (minutos: number) => ({ horas: Math.floor(minutos / 60), minutos: minutos % 60 });
const rango = (inicioMin: number, finMin: number) => rangoHoras(partes(inicioMin), partes(finMin));

function instanteLima(fechaISO: string, minutos: number) {
  return new Date(`${fechaISO}T${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}:00-05:00`);
}

/**
 * Patrón semanal como evento recurrente (la librería lo proyecta a cada semana visible). Un horario
 * excepcional (fin <= inicio) termina al día siguiente.
 */
function semanal(diaSemana: number, inicioMin: number, finMin: number) {
  const fecha = sumarDiasISO(LUNES_ANCLA, diaSemana - 1);
  return {
    start: instanteLima(fecha, inicioMin),
    end: finMin > inicioMin ? instanteLima(fecha, finMin) : instanteLima(sumarDiasISO(fecha, 1), finMin),
    recurrence: { freq: "weekly" as const },
  };
}

export function construirEventos(datos: DatosCalendario, consulta: string): EventoCalendario[] {
  const ahora = new Date();
  const eventos: EventoCalendario[] = [];

  for (const horario of datos.horarios) {
    const inicioMin = minutosDeTime(horario.horaInicio);
    const finMin = minutosDeTime(horario.horaFin);
    const { curso } = horario;
    const nombreCurso = aOracion(curso.nombre);
    const modalidad = curso.modalidad ? ETIQUETA_MODALIDAD[curso.modalidad] : null;
    eventos.push({
      id: `h-${horario.idHorario}`,
      title: nombreCurso,
      ...semanal(horario.diaSemana, inicioMin, finMin),
      color: colorCurso(curso.idCurso),
      readOnly: true,
      data: {
        filtro: "clases",
        subtitulo: [rango(inicioMin, finMin), modalidad].filter(Boolean).join(" · "),
        lineas: [
          { icono: "hora", texto: `${DIAS_LARGOS[horario.diaSemana - 1]} · ${rango(inicioMin, finMin)}` },
          { icono: "repite", texto: "Cada semana del ciclo" },
          ...(modalidad || curso.docente
            ? [{ icono: "lugar" as const, texto: [modalidad, curso.docente ? formatoTitulo(curso.docente) : null].filter(Boolean).join(" · ") }]
            : []),
          ...(curso.proximaEvaluacion
            ? [{
                icono: "evaluacion" as const,
                texto: `Próxima evaluación: ${curso.proximaEvaluacion.nombre}, ${fechaCorta(curso.proximaEvaluacion.fechaCierre, { ahora })}`,
              }]
            : []),
        ],
        acciones: [
          { texto: "Ver curso", href: `/cursos/${curso.idCurso}`, principal: true },
          { texto: "Editar sesión", href: `/cursos/${curso.idCurso}?sesion=${horario.idHorario}` },
        ],
        semanal: { diaSemana: horario.diaSemana, inicioMin, finMin },
      },
    });
  }

  for (const bloque of datos.bloquesOcupados) {
    const inicioMin = minutosDeTime(bloque.horaInicio);
    const finMin = minutosDeTime(bloque.horaFin);
    const tipo = ETIQUETA_BLOQUE[bloque.tipo];
    eventos.push({
      id: `b-${bloque.idBloqueOcupado}`,
      title: bloque.detalle || tipo,
      ...semanal(bloque.diaSemana, inicioMin, finMin),
      color: COLOR_BLOQUE[bloque.tipo],
      readOnly: true,
      data: {
        filtro: bloque.tipo,
        subtitulo: `${rango(inicioMin, finMin)} · ${tipo}`,
        lineas: [
          { icono: "hora", texto: `${DIAS_LARGOS[bloque.diaSemana - 1]} · ${rango(inicioMin, finMin)}` },
          { icono: "repite", texto: "Cada semana" },
          { icono: "estado", texto: `Tiempo ocupado · ${tipo}` },
        ],
        acciones: [{ texto: "Editar", href: `/calendario/bloques/${bloque.idBloqueOcupado}${consulta}`, principal: true }],
        semanal: { diaSemana: bloque.diaSemana, inicioMin, finMin },
      },
    });
  }

  // Entregas: van en la fila "Entregas" (todo el día) con su hora de cierre en el texto.
  const entrega = (
    id: string,
    titulo: string,
    fecha: Date,
    filtro: FiltroCalendario,
    color: string,
    contexto: string,
    href: string,
    textoAccion: string,
  ) => {
    const diaISO = fechaEnZonaLimaISO(fecha);
    const minutos = minutosDelDiaLima(fecha);
    const hora = formatoHora(Math.floor(minutos / 60), minutos % 60);
    eventos.push({
      id,
      title: `${titulo} · ${hora}`,
      start: new Date(`${diaISO}T00:00:00-05:00`),
      end: new Date(`${sumarDiasISO(diaISO, 1)}T00:00:00-05:00`),
      allDay: true,
      color,
      readOnly: true,
      data: {
        filtro,
        subtitulo: contexto,
        lineas: [
          { icono: "hora", texto: `Vence ${fechaCorta(fecha, { ahora })}, ${hora}` },
          { icono: filtro === "tareas" ? "grupo" : "evaluacion", texto: contexto },
        ],
        acciones: [{ texto: textoAccion, href, principal: true }],
      },
    });
  };

  for (const evaluacion of datos.evaluaciones) {
    entrega(`e-${evaluacion.idEvaluacion}`, evaluacion.nombre, evaluacion.fechaCierre, "evaluaciones", "var(--cal-evaluacion)",
      aOracion(evaluacion.curso.nombre), `/cursos/${evaluacion.idCurso}?evaluacion=${evaluacion.idEvaluacion}`, "Ver evaluación");
  }
  for (const tarea of datos.tareas) {
    if (!tarea.fechaLimite) continue;
    entrega(`t-${tarea.idTarea}`, tarea.titulo, tarea.fechaLimite, "tareas", "var(--cal-tarea)",
      tarea.grupo.nombre, `/grupos/${tarea.idGrupo}?tarea=${tarea.idTarea}`, "Abrir tarea");
  }

  for (const reunion of datos.reuniones) {
    const inicioMin = minutosDelDiaLima(reunion.inicio);
    const finMin = minutosDelDiaLima(reunion.fin) || 24 * 60;
    eventos.push({
      id: `r-${reunion.idReunion}`,
      title: reunion.titulo,
      start: reunion.inicio,
      end: reunion.fin,
      color: "var(--cal-reunion)",
      readOnly: true,
      data: {
        filtro: "reuniones",
        subtitulo: `${rango(inicioMin, finMin)} · ${reunion.grupo.nombre}`,
        lineas: [
          { icono: "hora", texto: `${diaYMes(reunion.inicio, ahora)} · ${rango(inicioMin, finMin)}` },
          { icono: "grupo", texto: reunion.grupo.nombre },
        ],
        acciones: [{ texto: "Ver reunión", href: `/reuniones?grupo=${reunion.idGrupo}#reunion-${reunion.idReunion}`, principal: true }],
      },
    });
  }

  return eventos;
}

/** Minutos de una ventana semanal; si cruza la medianoche, suma hasta el día siguiente. */
export function duracionVentana(ventana: { inicioMin: number; finMin: number }) {
  return ventana.finMin > ventana.inicioMin ? ventana.finMin - ventana.inicioMin : 1440 - ventana.inicioMin + ventana.finMin;
}

/** Minutos por semana de cada categoría del horario fijo (lo que el grupo ve como "ocupado"). */
export function minutosPorFiltro(eventos: EventoCalendario[]): Partial<Record<FiltroCalendario, number>> {
  const totales: Partial<Record<FiltroCalendario, number>> = {};
  for (const evento of eventos) {
    const ventana = evento.data?.semanal;
    if (!ventana || !evento.data) continue;
    totales[evento.data.filtro] = (totales[evento.data.filtro] ?? 0) + duracionVentana(ventana);
  }
  return totales;
}

/**
 * Horario semanal de un compañero (AGENTS.md 8.2): clases con el nombre del curso y bloques solo
 * con su categoría (Laboral / Familiar-Personal). Nunca el detalle de un bloque ni las entregas.
 */
export function construirEventosCompanero(horario: {
  horarios: { idHorario: number; diaSemana: number; horaInicio: Date; horaFin: Date; curso: string; idCurso: number }[];
  bloques: { idBloqueOcupado: number; diaSemana: number; horaInicio: Date; horaFin: Date; categoria: "laboral" | "fam" }[];
}): EventoCalendario[] {
  const eventos: EventoCalendario[] = [];
  for (const sesion of horario.horarios) {
    const inicioMin = minutosDeTime(sesion.horaInicio);
    const finMin = minutosDeTime(sesion.horaFin);
    eventos.push({
      id: `h-${sesion.idHorario}`,
      title: aOracion(sesion.curso),
      ...semanal(sesion.diaSemana, inicioMin, finMin),
      color: colorCurso(sesion.idCurso),
      readOnly: true,
      data: {
        filtro: "clases",
        subtitulo: rango(inicioMin, finMin),
        lineas: [
          { icono: "hora", texto: `${DIAS_LARGOS[sesion.diaSemana - 1]} · ${rango(inicioMin, finMin)}` },
          { icono: "repite", texto: "Clase · cada semana del ciclo" },
        ],
        acciones: [],
        semanal: { diaSemana: sesion.diaSemana, inicioMin, finMin },
      },
    });
  }
  for (const bloque of horario.bloques) {
    const inicioMin = minutosDeTime(bloque.horaInicio);
    const finMin = minutosDeTime(bloque.horaFin);
    const laboral = bloque.categoria === "laboral";
    const categoria = laboral ? "Laboral" : "Familiar / Personal";
    eventos.push({
      id: `b-${bloque.idBloqueOcupado}`,
      title: categoria,
      ...semanal(bloque.diaSemana, inicioMin, finMin),
      color: laboral ? COLOR_BLOQUE.laboral : COLOR_BLOQUE.familiar,
      readOnly: true,
      data: {
        filtro: laboral ? "laboral" : "familiar",
        subtitulo: rango(inicioMin, finMin),
        lineas: [
          { icono: "hora", texto: `${DIAS_LARGOS[bloque.diaSemana - 1]} · ${rango(inicioMin, finMin)}` },
          { icono: "estado", texto: `Ocupado · ${categoria}` },
        ],
        acciones: [],
        semanal: { diaSemana: bloque.diaSemana, inicioMin, finMin },
      },
    });
  }
  return eventos;
}
