import { NextResponse } from "next/server";
import { obtenerSesion } from "@/server/auth/session";
import { entregaSchema } from "@/lib/validation/entrega";
import { enviarEntrega } from "@/server/services/entrega";
import { LIMITES_ENTREGA } from "@/lib/entregas";
import { mensajeParaUsuario } from "@/lib/errores";
import { revalidatePath } from "next/cache";

// Cabecera del multipart y campos de texto: margen sobre el tope de archivos.
const MARGEN_CUERPO = 256 * 1024;

function error(mensaje: string, estado: number) {
  return NextResponse.json({ ok: false, error: mensaje }, { status: estado });
}

/** Envia una entrega (multipart/form-data) y pasa la tarea a revision. Responde JSON para la barra de progreso. */
export async function POST(request: Request) {
  // Defensa extra contra envios desde otros sitios (la cookie ya es SameSite, pero esto es barato).
  const origen = request.headers.get("origin");
  if (origen) {
    let hostOrigen: string | null = null;
    try {
      hostOrigen = new URL(origen).host; // "null" (origen opaco) lanza
    } catch {}
    if (hostOrigen !== new URL(request.url).host) return error("Solicitud no permitida", 403);
  }

  const sesion = await obtenerSesion();
  if (!sesion) return error("Tu sesión expiró. Vuelve a entrar", 401);

  // Se rechaza antes de leer el cuerpo: asi un archivo enorme no llega a la memoria.
  const largo = Number(request.headers.get("content-length"));
  if (!Number.isFinite(largo) || largo <= 0) return error("Solicitud no válida", 400);
  if (largo > LIMITES_ENTREGA.bytesPorEntrega + MARGEN_CUERPO) {
    return error("Los archivos superan el tamaño permitido", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error("No se pudo leer el envío", 400);
  }

  const parseo = entregaSchema.safeParse({
    idGrupo: formData.get("idGrupo"),
    idTarea: formData.get("idTarea"),
    titulo: formData.get("titulo") ?? "",
    descripcion: String(formData.get("descripcion") ?? ""),
    enlace: String(formData.get("enlace") ?? ""),
  });
  if (!parseo.success) return error(parseo.error.issues[0].message, 400);

  const archivos = await Promise.all(
    formData
      .getAll("archivos")
      .filter((valor): valor is File => valor instanceof File && valor.name !== "")
      .map(async (archivo) => ({ nombre: archivo.name, datos: new Uint8Array(await archivo.arrayBuffer()) })),
  );

  try {
    await enviarEntrega(sesion.idUsuario, parseo.data, archivos);
  } catch (causa) {
    return error(mensajeParaUsuario(causa, "No se pudo enviar la entrega"), 400);
  }

  const { idGrupo } = parseo.data;
  revalidatePath(`/grupos/${idGrupo}`);
  revalidatePath(`/grupos/${idGrupo}/tareas`);
  revalidatePath(`/grupos/${idGrupo}/actividad`);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
