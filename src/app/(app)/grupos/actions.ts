"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import { crearGrupoSchema, actualizarGrupoSchema, invitacionGrupoSchema, responderInvitacionSchema } from "@/lib/validation/grupo";
import { idRegistroSchema } from "@/lib/validation/tarea";
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
  const grupoId = idRegistroSchema.safeParse(idGrupo);
  if (!grupoId.success) redirect("/grupos");
  const parseo = actualizarGrupoSchema.safeParse(leerFormData(formData));

  if (!parseo.success) {
    redirect(`/grupos/${idGrupo}?error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  try {
    await grupoService.actualizarGrupo(sesion.idUsuario, grupoId.data, parseo.data);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo actualizar el grupo");
    redirect(`/grupos/${idGrupo}?error=${encodeURIComponent(mensaje)}`);
  }
  revalidatePath(`/grupos/${idGrupo}`);
  revalidatePath(`/grupos/${idGrupo}/tareas`);
  revalidatePath(`/grupos/${idGrupo}/tareas/[idTarea]`, "page");
  revalidatePath("/invitaciones");
  revalidatePath("/");
  revalidatePath("/grupos");
  redirect("/grupos");
}

export async function invitarIntegranteAction(idGrupo: number, formData: FormData) {
  const sesion = await requerirSesion();
  const grupoId = idRegistroSchema.safeParse(idGrupo);
  if (!grupoId.success) redirect("/grupos");
  const parseo = invitacionGrupoSchema.safeParse({ idGrupo: grupoId.data, idUsuario: formData.get("idUsuario") });

  if (!parseo.success) {
    redirect(`/grupos/${idGrupo}?error=${encodeURIComponent("Selecciona a alguien de la busqueda")}`);
  }

  try {
    await grupoService.invitarIntegrante(sesion.idUsuario, parseo.data.idGrupo, parseo.data.idUsuario);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo invitar");
    redirect(`/grupos/${idGrupo}?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath(`/grupos/${idGrupo}`);
  redirect(`/grupos/${idGrupo}`);
}

export async function responderInvitacionAction(idGrupo: number, respuesta: "aceptada" | "rechazada") {
  const sesion = await requerirSesion();
  const parseo = responderInvitacionSchema.safeParse({ idGrupo, respuesta });
  if (!parseo.success) redirect(`/invitaciones?error=${encodeURIComponent("La respuesta a la invitación no es válida")}`);
  try {
    await grupoService.responderInvitacion(sesion.idUsuario, parseo.data.idGrupo, parseo.data.respuesta);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo responder a la invitación");
    redirect(`/invitaciones?error=${encodeURIComponent(mensaje)}`);
  }
  revalidatePath("/invitaciones");
  revalidatePath("/grupos");
  redirect("/invitaciones");
}

export async function retirarIntegranteAction(idGrupo: number, idUsuarioObjetivo: number) {
  const sesion = await requerirSesion();
  const grupoId = idRegistroSchema.safeParse(idGrupo);
  const usuarioId = idRegistroSchema.safeParse(idUsuarioObjetivo);
  if (!grupoId.success || !usuarioId.success) {
    redirect("/grupos");
  }

  try {
    await grupoService.retirarIntegrante(sesion.idUsuario, grupoId.data, usuarioId.data);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo retirar");
    redirect(`/grupos/${idGrupo}?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath(`/grupos/${idGrupo}`);
  revalidatePath(`/grupos/${idGrupo}/tareas`);
  revalidatePath(`/grupos/${idGrupo}/tareas/[idTarea]`, "page");
  revalidatePath(`/grupos/${idGrupo}/actividad`);
  revalidatePath("/calendario");
  revalidatePath("/");
  redirect(`/grupos/${idGrupo}`);
}
