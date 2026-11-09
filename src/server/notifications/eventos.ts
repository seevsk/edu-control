/**
 * Unica fuente de verdad de que eventos mandan correo (AGENTS.md 8.6).
 * `actividad: true` = se silencia si el destinatario apago correo_actividad para ese grupo.
 */
export const EVENTOS_NOTIFICACION = {
  invitacion_grupo: { correo: true, actividad: false },
  invitacion_respondida: { correo: false, actividad: false },
  tarea_asignada: { correo: true, actividad: false },
  tarea_en_revision: { correo: true, actividad: true },
  tarea_devuelta: { correo: true, actividad: false },
  tarea_completada: { correo: false, actividad: true },
  tarea_reabierta: { correo: false, actividad: false },
  tarea_reprogramada: { correo: false, actividad: false },
  tarea_descartada: { correo: false, actividad: false },
  // Requiere que los invitados confirmen asistencia, por eso se considera importante.
  reunion_programada: { correo: true, actividad: false },
} as const;

export type TipoNotificacionConfigurado = keyof typeof EVENTOS_NOTIFICACION;
