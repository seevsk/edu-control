import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "@/server/db/client";
import { ErrorDeNegocio } from "@/lib/errores";

/**
 * Con el adaptador `pg`, un conflicto serializable (40001/40P01) a veces llega como
 * DriverAdapterError { kind: "TransactionWriteConflict" } en lugar de P2034.
 */
function esConflictoDeEscritura(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2034";
  if (!(error instanceof Error) || error.name !== "DriverAdapterError") return false;
  const causa = (error as Error & { cause?: { kind?: unknown } }).cause;
  return causa?.kind === "TransactionWriteConflict";
}

/** Permisos, valores anteriores y escrituras deben ver el mismo estado del grupo. */
export async function ejecutarCambioDeGrupo<T>(cambio: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(cambio, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (esConflictoDeEscritura(error)) {
      throw new ErrorDeNegocio("El grupo cambió mientras guardabas. Actualiza la página e intenta de nuevo");
    }
    throw error;
  }
}
