"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import { crearTareaSchema } from "@/lib/validation/tarea";
import * as tareaService from "@/server/services/tarea";

function leerFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirigirConError(idGrupo: number, mensaje: string): never {
  redirect(`/grupos/${idGrupo}/tareas?error=${encodeURIComponent(mensaje)}`);
}

export async function crearTareaAction(idGrupo: number, formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = crearTareaSchema.safeParse(leerFormData(formData));

  if (!parseo.success) redirigirConError(idGrupo, parseo.error.issues[0].message);

  try {
    await tareaService.crearTarea(sesion.idUsuario, idGrupo, parseo.data);
  } catch (error) {
    redirigirConError(idGrupo, error instanceof Error ? error.message : "No se pudo crear la tarea");
  }

  revalidatePath(`/grupos/${idGrupo}/tareas`);
  redirect(`/grupos/${idGrupo}/tareas`);
}

export async function reasignarTareaAction(idGrupo: number, idTarea: number, formData: FormData) {
  const sesion = await requerirSesion();
  const idAsignado = String(formData.get("idAsignado") ?? "");

  try {
    await tareaService.reasignarTarea(sesion.idUsuario, idGrupo, idTarea, idAsignado);
  } catch (error) {
    redirigirConError(idGrupo, error instanceof Error ? error.message : "No se pudo reasignar");
  }

  revalidatePath(`/grupos/${idGrupo}/tareas`);
  redirect(`/grupos/${idGrupo}/tareas`);
}

export async function cambiarEstadoTareaAction(
  idGrupo: number,
  idTarea: number,
  nuevoEstado: "pendiente" | "en_progreso" | "en_revision" | "completada",
) {
  const sesion = await requerirSesion();

  try {
    await tareaService.cambiarEstadoTarea(sesion.idUsuario, idGrupo, idTarea, nuevoEstado);
  } catch (error) {
    redirigirConError(idGrupo, error instanceof Error ? error.message : "No se pudo cambiar el estado");
  }

  revalidatePath(`/grupos/${idGrupo}/tareas`);
  redirect(`/grupos/${idGrupo}/tareas`);
}
