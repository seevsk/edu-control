"use server";

import { z } from "zod";
import { requerirSesion } from "@/server/auth/session";
import { buscarPersonas } from "@/server/services/grupo";

const consultaSchema = z.string().trim().max(120);

/** Busqueda en vivo del topbar: mismas reglas que /usuarios (visibilidad, minimo de caracteres, sin correo). */
export async function buscarPersonasAction(consulta: string) {
  const sesion = await requerirSesion();
  const parseo = consultaSchema.safeParse(consulta);
  if (!parseo.success || !parseo.data) return [];
  return buscarPersonas(sesion.idUsuario, parseo.data);
}
