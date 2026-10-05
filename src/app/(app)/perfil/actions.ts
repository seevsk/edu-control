"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
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
    redirect(`/perfil?error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  try {
    await perfilService.actualizarPerfil(sesion.idUsuario, parseo.data);
  } catch (error) {
    redirect(`/perfil?error=${encodeURIComponent(mensajeParaUsuario(error))}`);
  }

  revalidatePath("/perfil");
  redirect("/perfil");
}

export async function eliminarCuentaAction(formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = eliminarCuentaSchema.safeParse(leerFormData(formData));

  if (!parseo.success) {
    redirect(`/perfil?error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  await perfilService.eliminarCuenta(sesion.idUsuario);
  redirect("/login");
}
