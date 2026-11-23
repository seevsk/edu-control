import type { ContenidoCorreo, DetalleCorreo } from "@/server/email/contenido";
import { diaCompleto, fechaCompleta, hora } from "@/lib/formato-fecha";

/**
 * Plantillas en codigo, una por tipo de notificacion (AGENTS.md 8.6). La fila de `notificacion`
 * guarda el resultado final (mensaje, enlace), no la plantilla. `mensaje` no cambia de formato:
 * la Bandeja lo interpreta (src/lib/bandeja.ts). `correo` es el contenido del correo (texto plano,
 * el layout lo escapa); solo se envia si el tipo manda correo segun eventos.ts.
 */

/** Contexto opcional para el correo de una tarea: quien actuo, el grupo y los datos de la tarea. */
export interface ContextoTarea {
  actor?: string | null;
  grupo?: string | null;
  fechaLimite?: Date | null;
  peso?: number | null;
}

const ROLES = { lider: "Líder", miembro: "Miembro", observador: "Observador" } as const;

function cita(texto: string) {
  return `“${texto}”`;
}

/** Quita los detalles sin valor. */
function filas(...detalles: (DetalleCorreo | null | false | undefined)[]): DetalleCorreo[] {
  return detalles.filter((detalle): detalle is DetalleCorreo => Boolean(detalle && detalle.valor));
}

function motivoGrupo(grupo: string | null | undefined) {
  return grupo
    ? `Recibes este correo porque eres integrante de ${grupo} en EduControl.`
    : "Recibes este correo porque eres integrante de este grupo en EduControl.";
}

function detallesTarea(titulo: string, contexto: ContextoTarea | undefined, extra: (DetalleCorreo | null)[] = []) {
  return filas(
    { etiqueta: "Tarea", valor: titulo },
    contexto?.grupo ? { etiqueta: "Grupo", valor: contexto.grupo } : null,
    ...extra,
    contexto?.fechaLimite ? { etiqueta: "Fecha límite", valor: fechaCompleta(contexto.fechaLimite) } : null,
    contexto?.peso ? { etiqueta: "Peso", valor: `${contexto.peso} de 3` } : null,
  );
}

function enElGrupo(grupo: string | null | undefined) {
  return grupo ? ` en ${grupo}` : "";
}

export const plantillasNotificacion = {
  invitacionGrupo(
    nombreGrupo: string,
    idGrupo: number,
    invitador: string | null,
    contexto?: { rol?: keyof typeof ROLES },
  ) {
    const quien = invitador ?? "Un integrante";
    const comoObservador = contexto?.rol === "observador";
    const correo: ContenidoCorreo = {
      preheader: `${quien} quiere sumarte${comoObservador ? " como observador" : ""}. Acepta o rechaza la invitación desde tu Bandeja.`,
      titular: `Te invitaron a ${nombreGrupo}`,
      parrafos: [
        `${quien} te invitó a unirte al grupo ${nombreGrupo}${comoObservador ? " como observador" : ""} para coordinar tareas, avances y reuniones.`,
        "Antes de aceptar verás qué datos compartirás con los demás integrantes. La invitación se responde dentro de EduControl.",
      ],
      detalles: filas(
        { etiqueta: "Grupo", valor: nombreGrupo },
        invitador ? { etiqueta: "Invitado por", valor: invitador } : null,
        contexto?.rol ? { etiqueta: "Rol", valor: ROLES[contexto.rol] } : null,
      ),
      cta: "Responder invitación",
      motivo: `Recibes este correo porque ${invitador ?? "alguien"} te invitó a ${nombreGrupo} en EduControl.`,
    };
    return {
      mensaje: invitador ? `${invitador} te invitó a ${nombreGrupo}` : `Te invitaron a ${nombreGrupo}`,
      enlace: `/notificaciones?filtro=invitaciones&sel=inv-${idGrupo}`,
      asunto: invitador ? `${invitador} te invitó a ${nombreGrupo}` : `Te invitaron a ${nombreGrupo}`,
      correo,
    };
  },
  invitacionRespondida(nombreGrupo: string, idGrupo: number, respuesta: "aceptada" | "rechazada", persona: string | null) {
    const quien = persona ?? "Alguien";
    const verbo = respuesta === "aceptada" ? "aceptó" : "rechazó";
    const correo: ContenidoCorreo = {
      preheader: respuesta === "aceptada" ? `Ya forma parte de ${nombreGrupo}.` : `No se unirá a ${nombreGrupo}.`,
      titular: `${quien} ${verbo} tu invitación`,
      parrafos: [
        respuesta === "aceptada"
          ? `${quien} ya es integrante de ${nombreGrupo}. Desde ahora puedes asignarle tareas.`
          : `${quien} no se unirá a ${nombreGrupo}. Puedes volver a invitar a esta persona desde Integrantes.`,
      ],
      detalles: filas({ etiqueta: "Grupo", valor: nombreGrupo }, { etiqueta: "Respuesta", valor: respuesta === "aceptada" ? "Aceptada" : "Rechazada" }),
      cta: "Ver el grupo",
      motivo: `Recibes este correo porque invitaste a esta persona a ${nombreGrupo}.`,
      grupo: nombreGrupo,
    };
    return {
      mensaje: `${quien} ${verbo} tu invitación a ${nombreGrupo}`,
      enlace: `/grupos/${idGrupo}`,
      asunto: `${quien} ${verbo} tu invitación a ${nombreGrupo}`,
      correo,
    };
  },
  tareaAsignada(titulo: string, idGrupo: number, idTarea: number, contexto?: ContextoTarea) {
    const quien = contexto?.actor ?? "Un integrante";
    const vence = contexto?.fechaLimite ? `Vence el ${fechaCompleta(contexto.fechaLimite)}.` : "Revisa los detalles en EduControl.";
    const correo: ContenidoCorreo = {
      preheader: `${contexto?.grupo ? `${contexto.grupo} · ` : ""}${vence}`,
      titular: "Tienes una tarea nueva",
      parrafos: [
        `${quien} te asignó ${cita(titulo)}${enElGrupo(contexto?.grupo)}.`,
        "Muévela a En progreso cuando empieces y, al terminar, envía tu entrega para que el líder la revise.",
      ],
      detalles: detallesTarea(titulo, contexto, [contexto?.actor ? { etiqueta: "Asignada por", valor: contexto.actor } : null]),
      cta: "Ver la tarea",
      motivo: motivoGrupo(contexto?.grupo),
      grupo: contexto?.grupo ?? undefined,
    };
    return {
      mensaje: `Te asignaron “${titulo}”`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: contexto?.actor ? `${contexto.actor} te asignó “${titulo}”` : `Te asignaron “${titulo}”`,
      correo,
    };
  },
  tareaEnRevision(titulo: string, idGrupo: number, idTarea: number, contexto?: ContextoTarea) {
    const quien = contexto?.actor ?? "El responsable";
    const correo: ContenidoCorreo = {
      preheader: `${quien} terminó su parte y envió la entrega. Puedes verla y descargar sus archivos.`,
      titular: "Una tarea está lista para revisión",
      parrafos: [
        `${quien} terminó ${cita(titulo)} y envió su entrega${enElGrupo(contexto?.grupo)}.`,
        "El líder la aprueba o la devuelve con un motivo. Todos los integrantes pueden ver la entrega y descargar sus archivos.",
      ],
      detalles: detallesTarea(titulo, { ...contexto, fechaLimite: null, peso: null }, [
        contexto?.actor ? { etiqueta: "Entregada por", valor: contexto.actor } : null,
      ]),
      cta: "Ver la entrega",
      motivo: motivoGrupo(contexto?.grupo),
      grupo: contexto?.grupo ?? undefined,
    };
    return {
      mensaje: `“${titulo}” pasó a revisión`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: contexto?.actor ? `${contexto.actor} envió “${titulo}” a revisión` : `“${titulo}” pasó a revisión`,
      correo,
    };
  },
  tareaDevuelta(titulo: string, idGrupo: number, idTarea: number, motivo: string, contexto?: ContextoTarea) {
    const quien = contexto?.actor ?? "El líder";
    const correo: ContenidoCorreo = {
      preheader: `Motivo: ${motivo}`,
      titular: "Tu entrega necesita cambios",
      parrafos: [
        `${quien} revisó tu entrega de ${cita(titulo)} y la devolvió a En progreso.`,
        "Corrige lo que indica el motivo y envía una entrega nueva cuando esté lista.",
      ],
      cita: { etiqueta: "Motivo de la devolución", texto: motivo },
      detalles: detallesTarea(titulo, contexto, [contexto?.actor ? { etiqueta: "Devuelta por", valor: contexto.actor } : null]),
      cta: "Ver la tarea",
      motivo: `Recibes este correo porque eres responsable de esta tarea${enElGrupo(contexto?.grupo)}.`,
      grupo: contexto?.grupo ?? undefined,
    };
    return {
      mensaje: `Te devolvieron “${titulo}”. Motivo: ${motivo}`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: contexto?.actor ? `${contexto.actor} te devolvió “${titulo}”` : `Te devolvieron “${titulo}”`,
      correo,
    };
  },
  tareaCompletada(titulo: string, idGrupo: number, idTarea: number, contexto?: ContextoTarea) {
    const quien = contexto?.actor ?? "El líder";
    const correo: ContenidoCorreo = {
      preheader: "Tu parte ya cuenta en el avance del grupo.",
      titular: "Aprobaron tu entrega",
      parrafos: [`${quien} aprobó tu entrega de ${cita(titulo)} y la tarea quedó completada. Ya cuenta en el avance del grupo.`],
      detalles: detallesTarea(titulo, { ...contexto, fechaLimite: null }, [contexto?.actor ? { etiqueta: "Aprobada por", valor: contexto.actor } : null]),
      cta: "Ver la tarea",
      motivo: `Recibes este correo porque eres responsable de esta tarea${enElGrupo(contexto?.grupo)}.`,
      grupo: contexto?.grupo ?? undefined,
    };
    return {
      mensaje: `“${titulo}” se completó`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Se completó “${titulo}”`,
      correo,
    };
  },
  tareaAutoaprobada(titulo: string, idGrupo: number, idTarea: number, contexto?: ContextoTarea) {
    const quien = contexto?.actor ?? "El líder";
    const correo: ContenidoCorreo = {
      preheader: "La entrega no pasó por la revisión de otro integrante.",
      titular: "El líder aprobó su propia entrega",
      parrafos: [
        `${quien} aprobó su propia entrega de ${cita(titulo)}${enElGrupo(contexto?.grupo)}.`,
        "Puedes revisar la entrega y sus archivos desde la tarea.",
      ],
      detalles: detallesTarea(titulo, { ...contexto, fechaLimite: null, peso: null }),
      cta: "Ver la entrega",
      motivo: motivoGrupo(contexto?.grupo),
      grupo: contexto?.grupo ?? undefined,
    };
    return {
      mensaje: `El líder aprobó su propia entrega de “${titulo}”`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Entrega aprobada por el propio líder: “${titulo}”`,
      correo,
    };
  },
  tareaReabierta(titulo: string, idGrupo: number, idTarea: number, motivo: string, contexto?: ContextoTarea) {
    const quien = contexto?.actor ?? "El líder";
    const correo: ContenidoCorreo = {
      preheader: `Motivo: ${motivo}`,
      titular: "Reabrieron una tarea tuya",
      parrafos: [`${quien} reabrió ${cita(titulo)} y volvió a En progreso. Revisa el motivo y envía una entrega nueva.`],
      cita: { etiqueta: "Motivo", texto: motivo },
      detalles: detallesTarea(titulo, contexto),
      cta: "Ver la tarea",
      motivo: `Recibes este correo porque eres responsable de esta tarea${enElGrupo(contexto?.grupo)}.`,
      grupo: contexto?.grupo ?? undefined,
    };
    return {
      mensaje: `Reabrieron "${titulo}". Motivo: ${motivo}`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Reabrieron “${titulo}”`,
      correo,
    };
  },
  tareaReprogramada(titulo: string, idGrupo: number, idTarea: number, nuevaFecha: string, contexto?: ContextoTarea) {
    const quien = contexto?.actor ?? "Un integrante";
    const fecha = contexto?.fechaLimite ? fechaCompleta(contexto.fechaLimite) : nuevaFecha;
    const correo: ContenidoCorreo = {
      preheader: `Nueva fecha límite: ${fecha}.`,
      titular: "Cambió la fecha límite de tu tarea",
      parrafos: [`${quien} movió la fecha límite de ${cita(titulo)} al ${fecha}.`],
      detalles: detallesTarea(titulo, { ...contexto, peso: null }),
      cta: "Ver la tarea",
      motivo: `Recibes este correo porque eres responsable de esta tarea${enElGrupo(contexto?.grupo)}.`,
      grupo: contexto?.grupo ?? undefined,
    };
    return {
      mensaje: `La fecha límite de "${titulo}" cambió al ${nuevaFecha}.`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Nueva fecha límite para “${titulo}”`,
      correo,
    };
  },
  tareaDescartada(titulo: string, idGrupo: number, idTarea: number, motivo: string, contexto?: ContextoTarea) {
    const quien = contexto?.actor ?? "El líder";
    const correo: ContenidoCorreo = {
      preheader: `Motivo: ${motivo}`,
      titular: "Descartaron una tarea tuya",
      parrafos: [`${quien} descartó ${cita(titulo)}. Ya no hace falta trabajar en ella y no cuenta en el avance del grupo.`],
      cita: { etiqueta: "Motivo", texto: motivo },
      detalles: detallesTarea(titulo, { ...contexto, fechaLimite: null, peso: null }),
      cta: "Ver la tarea",
      motivo: `Recibes este correo porque eras responsable de esta tarea${enElGrupo(contexto?.grupo)}.`,
      grupo: contexto?.grupo ?? undefined,
    };
    return {
      mensaje: `Descartaron "${titulo}". Motivo: ${motivo}`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Descartaron “${titulo}”`,
      correo,
    };
  },
  reunionProgramada(
    titulo: string,
    nombreGrupo: string,
    _idGrupo: number,
    idReunion: number,
    cuando: string,
    contexto?: { organizador?: string | null; inicio?: Date; fin?: Date; videollamada?: boolean; lugar?: string | null },
  ) {
    const quien = contexto?.organizador ?? "Un integrante";
    const dia = contexto?.inicio ? diaCompleto(contexto.inicio) : null;
    const horario = contexto?.inicio && contexto.fin ? `${hora(contexto.inicio)} - ${hora(contexto.fin)}` : null;
    const correo: ContenidoCorreo = {
      preheader: `${dia && horario ? `${dia}, ${horario}` : cuando}. Confirma si asistirás.`,
      titular: "Nueva reunión del grupo",
      parrafos: [
        `${quien} programó ${cita(titulo)} en ${nombreGrupo}.`,
        contexto?.videollamada
          ? "Confirma si asistirás. La videollamada se abre en EduControl 10 minutos antes del inicio."
          : "Confirma si asistirás para que el grupo sepa con quién cuenta.",
      ],
      detalles: filas(
        { etiqueta: "Reunión", valor: titulo },
        { etiqueta: "Grupo", valor: nombreGrupo },
        dia ? { etiqueta: "Fecha", valor: dia } : { etiqueta: "Cuándo", valor: cuando },
        horario ? { etiqueta: "Hora", valor: horario } : null,
        contexto?.videollamada
          ? { etiqueta: "Dónde", valor: "Videollamada en EduControl" }
          : contexto?.lugar
            ? { etiqueta: "Dónde", valor: contexto.lugar }
            : null,
        contexto?.organizador ? { etiqueta: "Programada por", valor: contexto.organizador } : null,
      ),
      cta: "Confirmar asistencia",
      motivo: motivoGrupo(nombreGrupo),
      grupo: nombreGrupo,
    };
    return {
      mensaje: `Nueva reunión en "${nombreGrupo}": "${titulo}", ${cuando}.`,
      enlace: `/reuniones/${idReunion}`,
      asunto: contexto?.organizador ? `${contexto.organizador} programó “${titulo}”, ${cuando}` : `Reunión programada: “${titulo}”, ${cuando}`,
      correo,
    };
  },
  reunionIniciada(persona: string, titulo: string, nombreGrupo: string, idReunion: number, desde: string, hasta: string) {
    const correo: ContenidoCorreo = {
      preheader: `${persona} ya está en la sala. Únete desde EduControl.`,
      titular: "La reunión ya empezó",
      parrafos: [
        `${persona} entró a la videollamada ${cita(titulo)} de ${nombreGrupo}.`,
        "La sala queda abierta hasta 15 minutos después de la hora de fin.",
      ],
      detalles: filas(
        { etiqueta: "Reunión", valor: titulo },
        { etiqueta: "Grupo", valor: nombreGrupo },
        { etiqueta: "Horario", valor: `${desde} - ${hasta}` },
      ),
      cta: "Unirse a la reunión",
      motivo: motivoGrupo(nombreGrupo),
      grupo: nombreGrupo,
    };
    return {
      mensaje: `${persona} inició "${titulo}" en "${nombreGrupo}", ${desde} - ${hasta}.`,
      enlace: `/reuniones/${idReunion}`,
      asunto: `${persona} inició “${titulo}” en ${nombreGrupo}`,
      correo,
    };
  },
  reunionFinalizada(
    titulo: string,
    nombreGrupo: string,
    idReunion: number,
    duracion: string,
    entraron: number,
    finalizador: string | null,
  ) {
    const asistencia = entraron === 1 ? "1 integrante" : `${entraron} integrantes`;
    const correo: ContenidoCorreo = {
      preheader: `Duró ${duracion} y entraron ${asistencia}.`,
      titular: "La reunión terminó",
      parrafos: [
        finalizador
          ? `${finalizador} finalizó ${cita(titulo)} de ${nombreGrupo}.`
          : `${cita(titulo)} de ${nombreGrupo} se cerró automáticamente porque la sala quedó vacía.`,
      ],
      detalles: filas(
        { etiqueta: "Reunión", valor: titulo },
        { etiqueta: "Grupo", valor: nombreGrupo },
        { etiqueta: "Duración", valor: duracion },
        { etiqueta: "Entraron", valor: asistencia },
        { etiqueta: "Cierre", valor: finalizador ? `Finalizada por ${finalizador}` : "Automático" },
      ),
      cta: "Ver la reunión",
      motivo: motivoGrupo(nombreGrupo),
      grupo: nombreGrupo,
    };
    return {
      mensaje:
        `Terminó "${titulo}" en "${nombreGrupo}". Duró ${duracion}; ${entraron === 1 ? "entró 1" : `entraron ${entraron}`}.` +
        (finalizador ? ` La finalizó ${finalizador}.` : " Se cerró automáticamente."),
      enlace: `/reuniones/${idReunion}`,
      asunto: `Terminó la reunión “${titulo}”`,
      correo,
    };
  },
  integranteSalio(persona: string, nombreGrupo: string, idGrupo: number, ahoraEresLider: boolean) {
    const correo: ContenidoCorreo = {
      preheader: ahoraEresLider ? "Ahora eres el líder del grupo." : "Sus tareas abiertas quedaron sin asignar.",
      titular: ahoraEresLider ? `${persona} te dejó como líder` : `${persona} salió del grupo`,
      parrafos: [
        `${persona} salió de ${nombreGrupo}. Sus tareas abiertas quedaron sin asignar.`,
        ahoraEresLider ? "Ahora eres el líder: puedes invitar integrantes, revisar entregas y reasignar esas tareas." : "Reasígnalas desde el tablero para que no queden pendientes.",
      ],
      detalles: filas({ etiqueta: "Grupo", valor: nombreGrupo }, { etiqueta: "Salió", valor: persona }),
      cta: "Ver integrantes",
      motivo: `Recibes este correo porque eres líder de ${nombreGrupo}.`,
      grupo: nombreGrupo,
    };
    return {
      mensaje: ahoraEresLider
        ? `${persona} salió de ${nombreGrupo} y te dejó como líder`
        : `${persona} salió de ${nombreGrupo}`,
      enlace: `/grupos/${idGrupo}/integrantes`,
      asunto: `${persona} salió de ${nombreGrupo}`,
      correo,
    };
  },
  evaluacionCreada(
    nombre: string,
    nombreCurso: string,
    idCurso: number,
    idEvaluacion: number,
    cierre: string,
    contexto?: { fechaApertura?: Date | null; fechaCierre?: Date; requiereEntrega?: boolean },
  ) {
    const fechaCierre = contexto?.fechaCierre ? fechaCompleta(contexto.fechaCierre) : cierre;
    const correo: ContenidoCorreo = {
      preheader: `Cierra el ${fechaCierre}.`,
      titular: "Registraste una evaluación",
      parrafos: [
        `Agregaste ${nombre} a ${nombreCurso}. La verás en tu Inicio y en el Calendario hasta que la marques como terminada.`,
      ],
      detalles: filas(
        { etiqueta: "Evaluación", valor: nombre },
        { etiqueta: "Curso", valor: nombreCurso },
        contexto?.fechaApertura ? { etiqueta: "Abre", valor: fechaCompleta(contexto.fechaApertura) } : null,
        { etiqueta: "Cierra", valor: fechaCierre },
        contexto?.requiereEntrega === undefined
          ? null
          : { etiqueta: "Entrega", valor: contexto.requiereEntrega ? "Requiere entrega" : "Sin entrega" },
      ),
      cta: "Ver la evaluación",
      motivo: "Recibes este correo porque registraste esta evaluación en tu cuenta de EduControl.",
    };
    return {
      mensaje: `Registraste ${nombre} de ${nombreCurso}. Cierra ${cierre}`,
      enlace: `/cursos/${idCurso}?evaluacion=${idEvaluacion}`,
      asunto: `Evaluación registrada: ${nombre} · ${nombreCurso}`,
      correo,
    };
  },
};
