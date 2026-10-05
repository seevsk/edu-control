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
  // Solo campana (decision del usuario): ahorra cupo de correo.
  reunion_programada: { correo: false, actividad: false },
} as const;

export type TipoNotificacionConfigurado = keyof typeof EVENTOS_NOTIFICACION;
