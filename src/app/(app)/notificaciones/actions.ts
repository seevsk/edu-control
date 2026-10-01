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
