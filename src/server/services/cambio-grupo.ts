import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "@/server/db/client";
import { ErrorDeNegocio } from "@/lib/errores";

/** Permisos, valores anteriores y escrituras deben ver el mismo estado del grupo. */
export async function ejecutarCambioDeGrupo<T>(cambio: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(cambio, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new ErrorDeNegocio("El grupo cambió mientras guardabas. Actualiza la página e intenta de nuevo");
    }
    throw error;
  }
}
