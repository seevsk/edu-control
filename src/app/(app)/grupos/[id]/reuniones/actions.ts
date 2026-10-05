"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import { crearReunionSchema, responderReunionSchema } from "@/lib/validation/reunion";
import { mensajeParaUsuario } from "@/lib/errores";
import * as reunionService from "@/server/services/reunion";

function con(ruta: string, clave: "error" | "toast", valor: string) {
  const separador = ruta.includes("?") ? "&" : "?";
  return `${ruta}${separador}${clave}=${encodeURIComponent(valor)}`;
}

export async function crearReunionAction(idGrupo: number, formData: FormData) {
  const sesion = await requerirSesion();
  const formulario = `/grupos/${idGrupo}/reuniones/nueva`;
  const parseo = crearReunionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parseo.success) redirect(con(formulario, "error", parseo.error.issues[0].message));

  try {
    await reunionService.crearReunion(sesion.idUsuario, idGrupo, parseo.data);
  } catch (error) {
    redirect(con(formulario, "error", mensajeParaUsuario(error)));
  }

  revalidatePath(`/grupos/${idGrupo}/reuniones`);
  revalidatePath("/calendario");
  redirect(con(`/grupos/${idGrupo}/reuniones`, "toast", "Reunión programada"));
}

export async function responderReunionAction(idGrupo: number, idReunion: number, formData: FormData) {
  const sesion = await requerirSesion();
  const lista = `/grupos/${idGrupo}/reuniones`;
  const parseo = responderReunionSchema.safeParse({ respuesta: formData.get("respuesta") });
  if (!parseo.success) redirect(con(lista, "error", "Respuesta inválida"));

  try {
    await reunionService.responderReunion(sesion.idUsuario, idReunion, parseo.data.respuesta);
  } catch (error) {
    redirect(con(lista, "error", mensajeParaUsuario(error)));
  }

  revalidatePath(lista);
  redirect(lista);
}

export async function cancelarReunionAction(idGrupo: number, idReunion: number) {
  const sesion = await requerirSesion();
  const lista = `/grupos/${idGrupo}/reuniones`;

  try {
    await reunionService.cancelarReunion(sesion.idUsuario, idReunion);
  } catch (error) {
    redirect(con(lista, "error", mensajeParaUsuario(error)));
  }

  revalidatePath(lista);
  revalidatePath("/calendario");
  redirect(con(lista, "toast", "Reunión cancelada"));
}
