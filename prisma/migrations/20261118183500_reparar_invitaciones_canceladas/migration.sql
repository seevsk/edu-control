-- Antes de existir "cancelada", retirar a alguien con la invitacion pendiente lo dejaba como "retirado",
-- un estado definitivo que impedia volver a invitarlo. Quien nunca respondio nunca fue integrante:
-- esas filas pasan a "cancelada" para que se pueda volver a invitar.
-- Va en una migracion aparte: PostgreSQL no deja usar un valor de enum recien agregado en la misma transaccion.
UPDATE "grupo_integrante"
SET "estado_invitacion" = 'cancelada', "fecha_retiro" = NULL
WHERE "estado_invitacion" = 'retirado'
  AND "fecha_respuesta" IS NULL
  AND "retiro_voluntario" = false;
