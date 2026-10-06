"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import {
  crearTareaSchema,
  reasignarTareaSchema,
  contextoTareaSchema,
  cambiarEstadoTareaSchema,
  idRegistroSchema,
} from "@/lib/validation/tarea";
import * as tareaService from "@/server/services/tarea";
import { mensajeParaUsuario } from "@/lib/errores";

function leerFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirigirConError(idGrupo: number, mensaje: string): never {
  redirect(`/grupos/${idGrupo}/tareas?error=${encodeURIComponent(mensaje)}`);
}

function rutaTarea(idGrupo: number, idTarea: number, destino: "lista" | "detalle") {
  return destino === "detalle" ? `/grupos/${idGrupo}/tareas/${idTarea}` : `/grupos/${idGrupo}/tareas`;
}

function revalidarTarea(idGrupo: number, idTarea: number) {
  revalidatePath(`/grupos/${idGrupo}`);
  revalidatePath(`/grupos/${idGrupo}/tareas`);
  revalidatePath(`/grupos/${idGrupo}/tareas/${idTarea}`);
  revalidatePath(`/grupos/${idGrupo}/actividad`);
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function crearTareaAction(idGrupo: number, formData: FormData) {
  const sesion = await requerirSesion();
  const grupoId = idRegistroSchema.safeParse(idGrupo);
  if (!grupoId.success) redirect("/grupos");
  const parseo = crearTareaSchema.safeParse(leerFormData(formData));

  if (!parseo.success) redirigirConError(idGrupo, parseo.error.issues[0].message);

  try {
    await tareaService.crearTarea(sesion.idUsuario, grupoId.data, parseo.data);
  } catch (error) {
    redirigirConError(idGrupo, mensajeParaUsuario(error, "No se pudo crear la tarea"));
  }

  revalidatePath(`/grupos/${idGrupo}/tareas`);
  redirect(`/grupos/${idGrupo}/tareas`);
}

export async function reasignarTareaAction(
  idGrupo: number,
  idTarea: number,
  destino: "lista" | "detalle",
  formData: FormData,
) {
  const sesion = await requerirSesion();
  const contexto = contextoTareaSchema.safeParse({ idGrupo, idTarea, destino });
  if (!contexto.success) redirect("/grupos");
  const ruta = rutaTarea(contexto.data.idGrupo, contexto.data.idTarea, contexto.data.destino);
  const parseo = reasignarTareaSchema.safeParse(leerFormData(formData));
  if (!parseo.success) redirect(`${ruta}?error=${encodeURIComponent(parseo.error.issues[0].message)}`);

  try {
    await tareaService.reasignarTarea(sesion.idUsuario, contexto.data.idGrupo, contexto.data.idTarea, parseo.data.idAsignado ?? "");
  } catch (error) {
    redirect(`${ruta}?error=${encodeURIComponent(mensajeParaUsuario(error, "No se pudo reasignar"))}`);
  }

  revalidarTarea(idGrupo, idTarea);
  redirect(ruta);
}

export async function cambiarEstadoTareaAction(
  idGrupo: number,
  idTarea: number,
  nuevoEstado: "pendiente" | "en_progreso" | "en_revision" | "completada",
  destino: "lista" | "detalle",
) {
  const sesion = await requerirSesion();
  const contexto = cambiarEstadoTareaSchema.safeParse({ idGrupo, idTarea, nuevoEstado, destino });
  if (!contexto.success) redirect("/grupos");
  const ruta = rutaTarea(contexto.data.idGrupo, contexto.data.idTarea, contexto.data.destino);

  try {
    await tareaService.cambiarEstadoTarea(sesion.idUsuario, contexto.data.idGrupo, contexto.data.idTarea, contexto.data.nuevoEstado);
  } catch (error) {
    redirect(`${ruta}?error=${encodeURIComponent(mensajeParaUsuario(error, "No se pudo cambiar el estado"))}`);
  }

  revalidarTarea(idGrupo, idTarea);
  redirect(ruta);
}
