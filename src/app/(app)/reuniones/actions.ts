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

export async function crearReunionAction(formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = crearReunionSchema.safeParse(Object.fromEntries(formData.entries()));
  const idGrupo = Number(formData.get("idGrupo"));
  const formulario = Number.isInteger(idGrupo) && idGrupo > 0 ? `/reuniones/nueva?grupo=${idGrupo}` : "/reuniones/nueva";
  if (!parseo.success) redirect(con(formulario, "error", parseo.error.issues[0].message));

  try {
    await reunionService.crearReunion(sesion.idUsuario, parseo.data.idGrupo, parseo.data);
  } catch (error) {
    redirect(con(formulario, "error", mensajeParaUsuario(error)));
  }

  revalidatePath("/reuniones");
  revalidatePath("/calendario");
  redirect(con("/reuniones", "toast", "Reunión programada"));
}

export async function responderReunionAction(idReunion: number, formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = responderReunionSchema.safeParse({ respuesta: formData.get("respuesta") });
  if (!parseo.success) redirect(con("/reuniones", "error", "Respuesta inválida"));

  try {
    await reunionService.responderReunion(sesion.idUsuario, idReunion, parseo.data.respuesta);
  } catch (error) {
    redirect(con("/reuniones", "error", mensajeParaUsuario(error)));
  }

  revalidatePath("/reuniones");
  redirect(`/reuniones#reunion-${idReunion}`);
}

export async function cancelarReunionAction(idReunion: number) {
  const sesion = await requerirSesion();

  try {
    await reunionService.cancelarReunion(sesion.idUsuario, idReunion);
  } catch (error) {
    redirect(con("/reuniones", "error", mensajeParaUsuario(error)));
  }

  revalidatePath("/reuniones");
  revalidatePath("/calendario");
  redirect(con("/reuniones", "toast", "Reunión cancelada"));
}
