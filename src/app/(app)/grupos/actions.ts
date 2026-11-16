"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import {
  crearGrupoSchema,
  actualizarGrupoSchema,
  actualizarPreferenciaCorreoActividadSchema,
  invitacionGrupoSchema,
  responderInvitacionSchema,
} from "@/lib/validation/grupo";
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
    redirect(`/grupos?nuevo=1&error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  const grupo = await grupoService.crearGrupo(sesion.idUsuario, parseo.data);
  revalidatePath("/grupos");
  redirect(`/grupos/${grupo.idGrupo}?nuevo=1`);
}

export async function actualizarGrupoAction(idGrupo: number, formData: FormData) {
  const sesion = await requerirSesion();
  const grupoId = idRegistroSchema.safeParse(idGrupo);
  if (!grupoId.success) redirect("/grupos");
  const parseo = actualizarGrupoSchema.safeParse(leerFormData(formData));

  if (!parseo.success) {
    redirect(`/grupos/${idGrupo}/configuracion?error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  try {
    await grupoService.actualizarGrupo(sesion.idUsuario, grupoId.data, parseo.data);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo actualizar el grupo");
    redirect(`/grupos/${idGrupo}/configuracion?error=${encodeURIComponent(mensaje)}`);
  }
  revalidatePath(`/grupos/${idGrupo}`);
  revalidatePath(`/grupos/${idGrupo}/tareas`);
  revalidatePath(`/grupos/${idGrupo}/tareas/[idTarea]`, "page");
  revalidatePath("/notificaciones");
  revalidatePath("/");
  revalidatePath("/grupos");
  redirect(`/grupos/${idGrupo}/configuracion?toast=${encodeURIComponent("Cambios guardados")}`);
}

export async function invitarIntegranteAction(idGrupo: number, formData: FormData) {
  const sesion = await requerirSesion();
  const grupoId = idRegistroSchema.safeParse(idGrupo);
  if (!grupoId.success) redirect("/grupos");
  const parseo = invitacionGrupoSchema.safeParse({ idGrupo: grupoId.data, idUsuario: formData.get("idUsuario") });

  if (!parseo.success) {
    redirect(`/grupos/${idGrupo}/integrantes?error=${encodeURIComponent("Selecciona a alguien de la búsqueda")}`);
  }

  try {
    await grupoService.invitarIntegrante(sesion.idUsuario, parseo.data.idGrupo, parseo.data.idUsuario);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo invitar");
    redirect(`/grupos/${idGrupo}/integrantes?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath(`/grupos/${idGrupo}`);
  revalidatePath(`/grupos/${idGrupo}/integrantes`);
  redirect(`/grupos/${idGrupo}/integrantes`);
}

export async function responderInvitacionAction(
  idGrupo: number,
  respuesta: "aceptada" | "rechazada",
  formData: FormData,
) {
  const sesion = await requerirSesion();
  const parseo = responderInvitacionSchema.safeParse({
    idGrupo,
    respuesta,
    consentimientoPrivacidad: formData.get("consentimientoPrivacidad"),
  });
  if (!parseo.success) {
    redirect(`/notificaciones?filtro=invitaciones&sel=inv-${idGrupo}&error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }
  try {
    await grupoService.responderInvitacion(sesion.idUsuario, parseo.data.idGrupo, parseo.data.respuesta);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo responder a la invitación");
    redirect(`/notificaciones?filtro=invitaciones&sel=inv-${idGrupo}&error=${encodeURIComponent(mensaje)}`);
  }
  revalidatePath("/notificaciones");
  revalidatePath("/grupos");
  redirect(`/notificaciones?filtro=invitaciones&sel=inv-${idGrupo}`);
}

export async function actualizarPreferenciaCorreoActividadAction(idGrupo: number, formData: FormData) {
  const sesion = await requerirSesion();
  const grupoId = idRegistroSchema.safeParse(idGrupo);
  if (!grupoId.success) redirect("/grupos");

  const parseo = actualizarPreferenciaCorreoActividadSchema.safeParse({
    correoActividad: formData.get("correoActividad") === "on",
  });
  if (!parseo.success) {
    redirect(`/grupos/${idGrupo}/integrantes?error=${encodeURIComponent("La preferencia no es válida")}`);
  }

  try {
    await grupoService.actualizarPreferenciaCorreoActividad(
      sesion.idUsuario,
      grupoId.data,
      parseo.data.correoActividad,
    );
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo guardar la preferencia");
    redirect(`/grupos/${idGrupo}/integrantes?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath(`/grupos/${idGrupo}`);
  revalidatePath(`/grupos/${idGrupo}/integrantes`);
  redirect(`/grupos/${idGrupo}/integrantes?toast=${encodeURIComponent("Preferencia de correo guardada")}`);
}

/** Salir por cuenta propia. Si es líder, el formulario envía `nuevoLider`. */
export async function salirDelGrupoAction(idGrupo: number, formData: FormData) {
  const sesion = await requerirSesion();
  const grupoId = idRegistroSchema.safeParse(idGrupo);
  if (!grupoId.success) redirect("/grupos");
  const nuevoLider = formData.get("nuevoLider");
  const liderId = nuevoLider ? idRegistroSchema.safeParse(Number(nuevoLider)) : null;
  if (liderId && !liderId.success) redirect(`/grupos/${idGrupo}/integrantes?error=${encodeURIComponent("Elige un nuevo líder válido")}`);

  try {
    await grupoService.salirDelGrupo(sesion.idUsuario, grupoId.data, liderId?.success ? liderId.data : undefined);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo salir del grupo");
    redirect(`/grupos/${idGrupo}/integrantes?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath("/grupos");
  revalidatePath(`/grupos/${idGrupo}`, "layout");
  revalidatePath("/calendario");
  revalidatePath("/");
  redirect(`/grupos?toast=${encodeURIComponent("Saliste del grupo")}`);
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
    redirect(`/grupos/${idGrupo}/integrantes?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath(`/grupos/${idGrupo}`);
  revalidatePath(`/grupos/${idGrupo}/integrantes`);
  revalidatePath(`/grupos/${idGrupo}/tareas`);
  revalidatePath(`/grupos/${idGrupo}/tareas/[idTarea]`, "page");
  revalidatePath(`/grupos/${idGrupo}/actividad`);
  revalidatePath("/calendario");
  revalidatePath("/");
  redirect(`/grupos/${idGrupo}/integrantes`);
}
