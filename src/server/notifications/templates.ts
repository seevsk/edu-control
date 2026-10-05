/**
 * Plantillas en codigo, una por tipo de notificacion (AGENTS.md 8.6). La fila de `notificacion`
 * guarda el resultado final (mensaje, enlace), no la plantilla.
 */
export const plantillasNotificacion = {
  invitacionGrupo(nombreGrupo: string) {
    return {
      mensaje: `Te invitaron al grupo "${nombreGrupo}".`,
      enlace: "/invitaciones",
      asunto: `Invitacion al grupo ${nombreGrupo}`,
    };
  },
  invitacionRespondida(nombreGrupo: string, idGrupo: number, respuesta: "aceptada" | "rechazada") {
    return {
      mensaje: `Respondieron tu invitacion al grupo "${nombreGrupo}": ${respuesta}.`,
      enlace: `/grupos/${idGrupo}`,
      asunto: `Respuesta a tu invitacion (${nombreGrupo})`,
    };
  },
  tareaAsignada(titulo: string, idGrupo: number) {
    return {
      mensaje: `Se te asigno "${titulo}".`,
      enlace: `/grupos/${idGrupo}/tareas`,
      asunto: `Nueva tarea asignada: ${titulo}`,
    };
  },
  tareaEnRevision(titulo: string, idGrupo: number) {
    return {
      mensaje: `"${titulo}" esta en revision.`,
      enlace: `/grupos/${idGrupo}/tareas`,
      asunto: `Tarea en revision: ${titulo}`,
    };
  },
  tareaDevuelta(titulo: string, idGrupo: number) {
    return {
      mensaje: `Te devolvieron "${titulo}".`,
      enlace: `/grupos/${idGrupo}/tareas`,
      asunto: `Te devolvieron una tarea: ${titulo}`,
    };
  },
  tareaCompletada(titulo: string, idGrupo: number) {
    return {
      mensaje: `"${titulo}" quedo completada.`,
      enlace: `/grupos/${idGrupo}/tareas`,
      asunto: `Tarea completada: ${titulo}`,
    };
  },
  reunionProgramada(titulo: string, nombreGrupo: string, idGrupo: number, cuando: string) {
    return {
      mensaje: `Nueva reunión en "${nombreGrupo}": "${titulo}", ${cuando}.`,
      enlace: `/reuniones?grupo=${idGrupo}`,
      asunto: `Reunión programada: ${titulo}`,
    };
  },
};
