"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cerrarSesion, requerirSesion } from "@/server/auth/session";
import { actualizarPerfilSchema, eliminarCuentaSchema } from "@/lib/validation/perfil";
import { mensajeParaUsuario } from "@/lib/errores";
import * as perfilService from "@/server/services/perfil";

function leerFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function actualizarPerfilAction(formData: FormData) {
  const sesion = await requerirSesion();
  const datos = leerFormData(formData);
  const parseo = actualizarPerfilSchema.safeParse({
    ...datos,
    trabaja: datos.trabaja === "on",
    visibleEnBusqueda: datos.visibleEnBusqueda === "on",
  });

  if (!parseo.success) {
    redirect(`/perfil?editar=1&error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  try {
    await perfilService.actualizarPerfil(sesion.idUsuario, parseo.data);
  } catch (error) {
    redirect(`/perfil?editar=1&error=${encodeURIComponent(mensajeParaUsuario(error))}`);
  }

  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  redirect(`/perfil?toast=${encodeURIComponent("Cambios guardados")}`);
}

/** Switch de privacidad: se guarda al instante, sin recargar la pagina. */
export async function cambiarVisibilidadAction(visible: boolean): Promise<{ ok: boolean }> {
  const sesion = await requerirSesion();
  if (typeof visible !== "boolean") return { ok: false };
  try {
    await perfilService.actualizarVisibilidad(sesion.idUsuario, visible);
  } catch {
    return { ok: false };
  }
  revalidatePath("/perfil");
  return { ok: true };
}

export async function eliminarCuentaAction(formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = eliminarCuentaSchema.safeParse(leerFormData(formData));

  if (!parseo.success) {
    redirect(`/perfil?errorCuenta=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  try {
    await perfilService.eliminarCuenta(sesion.idUsuario);
  } catch (error) {
    redirect(`/perfil?errorCuenta=${encodeURIComponent(mensajeParaUsuario(error))}`);
  }
  await cerrarSesion();
  redirect("/login");
}
