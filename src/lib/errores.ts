/**
 * Error de negocio: el mensaje esta pensado para mostrarse tal cual al usuario (en espanol,
 * sin detalles internos). Cualquier otro error (un bug, un fallo de Prisma) nunca debe llegar
 * a la pantalla como texto crudo -- ver AGENTS.md seccion 10.
 */
export class ErrorDeNegocio extends Error {}

/** Para usar en el catch de una Server Action: nunca expone detalles internos. */
export function mensajeParaUsuario(error: unknown, generico = "Algo salio mal, intenta de nuevo") {
  if (error instanceof ErrorDeNegocio) return error.message;
  console.error(error);
  return generico;
}
