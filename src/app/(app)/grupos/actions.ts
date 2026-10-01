"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import { crearGrupoSchema, actualizarGrupoSchema } from "@/lib/validation/grupo";
import * as grupoService from "@/server/services/grupo";
import { mensajeParaUsuario } from "@/lib/errores";

function leerFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function crearGrupoAction(formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = crearGrupoSchema.safeParse(leerFormData(formData));

  if (!parseo.success) {
    redirect(`/grupos?error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  const grupo = await grupoService.crearGrupo(sesion.idUsuario, parseo.data);
  revalidatePath("/grupos");
  redirect(`/grupos/${grupo.idGrupo}`);
}

export async function actualizarGrupoAction(idGrupo: number, formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = actualizarGrupoSchema.safeParse(leerFormData(formData));

  if (!parseo.success) {
    redirect(`/grupos/${idGrupo}?error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  await grupoService.actualizarGrupo(sesion.idUsuario, idGrupo, parseo.data);
  revalidatePath(`/grupos/${idGrupo}`);
  revalidatePath("/grupos");
  redirect("/grupos");
}

export async function invitarIntegranteAction(idGrupo: number, formData: FormData) {
  const sesion = await requerirSesion();
  const idUsuarioInvitado = Number(formData.get("idUsuario"));

  if (!Number.isInteger(idUsuarioInvitado)) {
    redirect(`/grupos/${idGrupo}?error=${encodeURIComponent("Selecciona a alguien de la busqueda")}`);
  }

  try {
    await grupoService.invitarIntegrante(sesion.idUsuario, idGrupo, idUsuarioInvitado);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo invitar");
    redirect(`/grupos/${idGrupo}?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath(`/grupos/${idGrupo}`);
  redirect(`/grupos/${idGrupo}`);
}

export async function responderInvitacionAction(idGrupo: number, respuesta: "aceptada" | "rechazada") {
  const sesion = await requerirSesion();
  await grupoService.responderInvitacion(sesion.idUsuario, idGrupo, respuesta);
  revalidatePath("/invitaciones");
  revalidatePath("/grupos");
  redirect("/invitaciones");
}

export async function retirarIntegranteAction(idGrupo: number, idUsuarioObjetivo: number) {
  const sesion = await requerirSesion();

  try {
    await grupoService.retirarIntegrante(sesion.idUsuario, idGrupo, idUsuarioObjetivo);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo retirar");
    redirect(`/grupos/${idGrupo}?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath(`/grupos/${idGrupo}`);
  redirect(`/grupos/${idGrupo}`);
}
