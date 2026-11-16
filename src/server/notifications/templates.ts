/**
 * Plantillas en codigo, una por tipo de notificacion (AGENTS.md 8.6). La fila de `notificacion`
 * guarda el resultado final (mensaje, enlace), no la plantilla.
 */
export const plantillasNotificacion = {
  invitacionGrupo(nombreGrupo: string, idGrupo: number, invitador: string | null) {
    return {
      mensaje: invitador ? `${invitador} te invitó a ${nombreGrupo}` : `Te invitaron a ${nombreGrupo}`,
      enlace: `/notificaciones?filtro=invitaciones&sel=inv-${idGrupo}`,
      asunto: `Invitación al grupo ${nombreGrupo}`,
    };
  },
  invitacionRespondida(nombreGrupo: string, idGrupo: number, respuesta: "aceptada" | "rechazada", persona: string | null) {
    return {
      mensaje: `${persona ?? "Alguien"} ${respuesta === "aceptada" ? "aceptó" : "rechazó"} tu invitación a ${nombreGrupo}`,
      enlace: `/grupos/${idGrupo}`,
      asunto: `Respuesta a tu invitación (${nombreGrupo})`,
    };
  },
  tareaAsignada(titulo: string, idGrupo: number, idTarea: number) {
    return {
      mensaje: `Te asignaron “${titulo}”`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Nueva tarea asignada: ${titulo}`,
    };
  },
  tareaEnRevision(titulo: string, idGrupo: number, idTarea: number) {
    return {
      mensaje: `“${titulo}” pasó a revisión`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Tarea en revisión: ${titulo}`,
    };
  },
  tareaDevuelta(titulo: string, idGrupo: number, idTarea: number, motivo: string) {
    return {
      mensaje: `Te devolvieron “${titulo}”. Motivo: ${motivo}`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Te devolvieron una tarea: ${titulo}`,
    };
  },
  tareaCompletada(titulo: string, idGrupo: number, idTarea: number) {
    return {
      mensaje: `“${titulo}” se completó`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Tarea completada: ${titulo}`,
    };
  },
  tareaReabierta(titulo: string, idGrupo: number, idTarea: number, motivo: string) {
    return {
      mensaje: `Reabrieron "${titulo}". Motivo: ${motivo}`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Reabrieron una tarea: ${titulo}`,
    };
  },
  tareaReprogramada(titulo: string, idGrupo: number, idTarea: number, nuevaFecha: string) {
    return {
      mensaje: `La fecha límite de "${titulo}" cambió al ${nuevaFecha}.`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Nueva fecha límite: ${titulo}`,
    };
  },
  tareaDescartada(titulo: string, idGrupo: number, idTarea: number, motivo: string) {
    return {
      mensaje: `Descartaron "${titulo}". Motivo: ${motivo}`,
      enlace: `/grupos/${idGrupo}/tareas/${idTarea}`,
      asunto: `Tarea descartada: ${titulo}`,
    };
  },
  reunionProgramada(titulo: string, nombreGrupo: string, idGrupo: number, idReunion: number, cuando: string) {
    return {
      mensaje: `Nueva reunión en "${nombreGrupo}": "${titulo}", ${cuando}.`,
      enlace: `/reuniones?grupo=${idGrupo}&reunion=${idReunion}`,
      asunto: `Reunión programada: ${titulo}`,
    };
  },
  integranteSalio(persona: string, nombreGrupo: string, idGrupo: number, ahoraEresLider: boolean) {
    return {
      mensaje: ahoraEresLider
        ? `${persona} salió de ${nombreGrupo} y te dejó como líder`
        : `${persona} salió de ${nombreGrupo}`,
      enlace: `/grupos/${idGrupo}/integrantes`,
      asunto: `${persona} salió de ${nombreGrupo}`,
    };
  },
  evaluacionCreada(nombre: string, nombreCurso: string, idCurso: number, idEvaluacion: number, cierre: string) {
    return {
      mensaje: `Registraste ${nombre} de ${nombreCurso}. Cierra ${cierre}`,
      enlace: `/cursos/${idCurso}?evaluacion=${idEvaluacion}`,
      asunto: `Nueva evaluación: ${nombre} (${nombreCurso})`,
    };
  },
};
