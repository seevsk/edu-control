"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import { crearReunionSchema, idGrupoSchema, idReunionSchema, responderReunionSchema } from "@/lib/validation/reunion";
import { mensajeParaUsuario } from "@/lib/errores";
import * as reunionService from "@/server/services/reunion";

const ERROR_SALA = "No se pudo crear la videollamada.";

function con(ruta: string, clave: "error" | "toast" | "ya" | "sala", valor: string) {
  const separador = ruta.includes("?") ? "&" : "?";
  return `${ruta}${separador}${clave}=${encodeURIComponent(valor)}`;
}

export async function crearReunionAction(formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = crearReunionSchema.safeParse(Object.fromEntries(formData.entries()));
  const idGrupo = Number(formData.get("idGrupo"));
  // En móvil el formulario es una hoja sobre la pestaña Reuniones del grupo (`origen=hoja`).
  const enHoja = formData.get("origen") === "hoja" && Number.isInteger(idGrupo) && idGrupo > 0;
  const formulario = enHoja
    ? `/grupos/${idGrupo}/reuniones?programar=1`
    : Number.isInteger(idGrupo) && idGrupo > 0
      ? `/reuniones/nueva?grupo=${idGrupo}`
      : "/reuniones/nueva";
  if (!parseo.success) redirect(con(formulario, "error", parseo.error.issues[0].message));

  try {
    await reunionService.crearReunion(sesion.idUsuario, parseo.data.idGrupo, parseo.data);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error);
    const destino = con(formulario, "error", mensaje);
    if (mensaje !== ERROR_SALA) redirect(destino);
    // Sin sala el formulario vuelve con lo escrito, para reintentar o usar un enlace propio.
    const { titulo, fecha, horaInicio, horaFin, lugar } = parseo.data;
    const conValores = Object.entries({ titulo, fecha, inicio: horaInicio, fin: horaFin, lugar: lugar ?? "" }).reduce(
      (ruta, [clave, valor]) => (valor ? `${ruta}&${clave}=${encodeURIComponent(valor)}` : ruta),
      destino,
    );
    redirect(con(conValores, "sala", "error"));
  }

  revalidatePath("/reuniones");
  revalidatePath("/calendario");
  revalidatePath(`/grupos/${parseo.data.idGrupo}/horarios`);
  if (enHoja) {
    revalidatePath(`/grupos/${parseo.data.idGrupo}/reuniones`);
    redirect(con(`/grupos/${parseo.data.idGrupo}/reuniones`, "toast", "Reunión programada"));
  }
  const horariosGrupo = `/grupos/${parseo.data.idGrupo}/horarios?semana=${parseo.data.fecha}`;
  redirect(con(horariosGrupo, "toast", "Reunión programada"));
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
  revalidatePath(`/reuniones/${idReunion}`);
  redirect(`/reuniones/${idReunion}`);
}

export async function cancelarReunionAction(idReunion: number) {
  const sesion = await requerirSesion();

  let idGrupo: number;
  try {
    idGrupo = await reunionService.cancelarReunion(sesion.idUsuario, idReunion);
  } catch (error) {
    redirect(con("/reuniones", "error", mensajeParaUsuario(error)));
  }

  revalidatePath("/reuniones");
  revalidatePath(`/grupos/${idGrupo}`, "layout");
  revalidatePath("/calendario");
  redirect(con("/reuniones", "toast", "Reunión cancelada"));
}

function revalidarReunion(idReunion: number, idGrupo: number) {
  revalidatePath("/reuniones");
  revalidatePath(`/reuniones/${idReunion}`);
  revalidatePath(`/grupos/${idGrupo}`, "layout");
  revalidatePath("/calendario");
}

export async function reunirseAhoraAction(idGrupoCrudo: number) {
  const sesion = await requerirSesion();
  const idGrupo = idGrupoSchema.safeParse(idGrupoCrudo);
  if (!idGrupo.success) redirect(con("/reuniones", "error", "Elige un grupo"));
  const volver = `/grupos/${idGrupo.data}/reuniones`;

  let idReunion: number;
  let yaExistia: boolean;
  try {
    const resultado = await reunionService.reunirseAhora(sesion.idUsuario, idGrupo.data);
    idReunion = resultado.idReunion;
    yaExistia = resultado.yaExistia;
    await reunionService.registrarEntrada(sesion.idUsuario, idReunion);
  } catch (error) {
    redirect(con(volver, "error", mensajeParaUsuario(error)));
  }

  revalidarReunion(idReunion, idGrupo.data);
  redirect(yaExistia ? con(`/reuniones/${idReunion}/sala`, "ya", "1") : `/reuniones/${idReunion}/sala`);
}

export async function unirseReunionAction(idReunionCrudo: number) {
  const sesion = await requerirSesion();
  const idReunion = idReunionSchema.safeParse(idReunionCrudo);
  if (!idReunion.success) redirect(con("/reuniones", "error", "Esa reunión ya no existe"));

  let idGrupo: number;
  try {
    idGrupo = await reunionService.registrarEntrada(sesion.idUsuario, idReunion.data);
  } catch (error) {
    redirect(con(`/reuniones/${idReunion.data}`, "error", mensajeParaUsuario(error)));
  }

  revalidarReunion(idReunion.data, idGrupo);
  redirect(`/reuniones/${idReunion.data}/sala`);
}

export async function finalizarReunionAction(idReunionCrudo: number) {
  const sesion = await requerirSesion();
  const idReunion = idReunionSchema.safeParse(idReunionCrudo);
  if (!idReunion.success) redirect(con("/reuniones", "error", "Esa reunión ya no existe"));

  let idGrupo: number;
  try {
    idGrupo = await reunionService.finalizarReunion(sesion.idUsuario, idReunion.data);
  } catch (error) {
    redirect(con(`/reuniones/${idReunion.data}`, "error", mensajeParaUsuario(error)));
  }

  revalidarReunion(idReunion.data, idGrupo);
  redirect(con(`/reuniones/${idReunion.data}`, "toast", "Reunión finalizada"));
}

/**
 * La llama la sala cuando quien sale cree ser la ultima persona: si el proveedor confirma que no
 * queda nadie, la reunion termina. No redirige; la sala navega al detalle despues.
 */
export async function salidaDeSalaAction(idReunionCrudo: number): Promise<void> {
  const sesion = await requerirSesion();
  const idReunion = idReunionSchema.safeParse(idReunionCrudo);
  if (!idReunion.success) return;

  try {
    const idGrupo = await reunionService.registrarSalida(sesion.idUsuario, idReunion.data);
    revalidarReunion(idReunion.data, idGrupo);
  } catch {
    // Sin acceso o ya no existe: la sala navega igual y el detalle responde 404.
  }
}

/** La llama el cliente de la sala al llegar el contador a cero; la pagina navega al detalle. */
export async function cerrarSiVencioAction(idReunionCrudo: number): Promise<void> {
  const sesion = await requerirSesion();
  const idReunion = idReunionSchema.safeParse(idReunionCrudo);
  if (!idReunion.success) return;

  try {
    const idGrupo = await reunionService.cerrarSiVencio(sesion.idUsuario, idReunion.data);
    revalidarReunion(idReunion.data, idGrupo);
  } catch {
    // Sin acceso o ya no existe: el cliente navega igual y el detalle responde 404.
  }
}
