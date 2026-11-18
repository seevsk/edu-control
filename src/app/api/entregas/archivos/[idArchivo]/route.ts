import { obtenerSesion } from "@/server/auth/session";
import { idRegistroSchema } from "@/lib/validation/tarea";
import { obtenerArchivoEntrega } from "@/server/services/entrega";

/**
 * Descarga de un archivo de entrega. Sin acceso (o inexistente) responde 404 igual, para no
 * confirmar que existe (AGENTS.md 8.3). Siempre como adjunto y sin que el navegador adivine el tipo.
 */
export async function GET(_request: Request, contexto: { params: Promise<{ idArchivo: string }> }) {
  const noEncontrado = () => new Response("No encontrado", { status: 404 });
  const sesion = await obtenerSesion();
  if (!sesion) return noEncontrado();
  const id = idRegistroSchema.safeParse((await contexto.params).idArchivo);
  if (!id.success) return noEncontrado();

  try {
    const archivo = await obtenerArchivoEntrega(sesion.idUsuario, id.data);
    return new Response(new Uint8Array(archivo.datos), {
      headers: {
        "Content-Type": archivo.mime,
        "Content-Length": String(archivo.datos.length),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return noEncontrado();
  }
}
