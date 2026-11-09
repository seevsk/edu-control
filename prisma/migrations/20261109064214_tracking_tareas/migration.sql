-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccionHistorial" ADD VALUE 'vista';
ALTER TYPE "AccionHistorial" ADD VALUE 'fecha_limite';
ALTER TYPE "AccionHistorial" ADD VALUE 'peso';

-- AlterEnum
ALTER TYPE "EstadoTarea" ADD VALUE 'descartada';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'tarea_reabierta';
ALTER TYPE "TipoNotificacion" ADD VALUE 'tarea_reprogramada';
ALTER TYPE "TipoNotificacion" ADD VALUE 'tarea_descartada';
