"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import * as notificacionService from "@/server/services/notificacion";

export async function marcarNotificacionLeidaAction(idNotificacion: number) {
  const sesion = await requerirSesion();
  await notificacionService.marcarNotificacionLeida(sesion.idUsuario, idNotificacion);
  revalidatePath("/notificaciones");
}

export async function marcarTodasLeidasAction() {
  const sesion = await requerirSesion();
  await notificacionService.marcarTodasLeidas(sesion.idUsuario);
  revalidatePath("/notificaciones");
}

/** Al abrir un elemento de la bandeja se marcan como leídas todas sus notificaciones apiladas. */
export async function marcarElementoLeidoAction(ids: number[]) {
  const sesion = await requerirSesion();
  const validos = ids.filter((id) => Number.isInteger(id) && id > 0).slice(0, 100);
  await notificacionService.marcarVariasLeidas(sesion.idUsuario, validos);
  revalidatePath("/notificaciones");
  revalidatePath("/", "layout");
}
