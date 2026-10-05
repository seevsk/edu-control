"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import { actualizarBloqueOcupadoSchema, crearBloqueOcupadoSchema } from "@/lib/validation/disponibilidad";
import * as disponibilidadService from "@/server/services/disponibilidad";

const RUTAS_PERMITIDAS = /^\/calendario(\/bloques\/(nuevo|\d+))?$/;
const BASE = "http://local";

/** Solo se redirige a rutas del propio calendario, nunca a una URL arbitraria del cliente. */
function rutaSegura(formData: FormData, campo: "volverA" | "origen"): URL {
  const crudo = formData.get(campo);
  const url = new URL(typeof crudo === "string" && crudo.startsWith("/") && !crudo.startsWith("//") ? crudo : "/calendario", BASE);
  if (url.origin !== BASE || !RUTAS_PERMITIDAS.test(url.pathname)) return new URL("/calendario", BASE);
  url.searchParams.delete("error");
  url.searchParams.delete("toast");
  return url;
}

function con(url: URL, clave: "error" | "toast", valor: string) {
  url.searchParams.set(clave, valor);
  return `${url.pathname}${url.search}`;
}

function camposBase(formData: FormData) {
  return {
    tipo: formData.get("tipo"),
    horaInicio: formData.get("horaInicio"),
    horaFin: formData.get("horaFin"),
    detalle: formData.get("detalle") ?? "",
  };
}

export async function crearBloqueOcupadoAction(formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = crearBloqueOcupadoSchema.safeParse({ ...camposBase(formData), dias: formData.getAll("dias") });

  if (!parseo.success) {
    redirect(con(rutaSegura(formData, "origen"), "error", parseo.error.issues[0].message));
  }

  const creados = await disponibilidadService.crearBloquesOcupados(sesion.idUsuario, parseo.data);
  revalidatePath("/calendario");
  redirect(con(rutaSegura(formData, "volverA"), "toast", creados === 1 ? "Bloque agregado" : `${creados} bloques agregados`));
}

export async function actualizarBloqueOcupadoAction(idBloqueOcupado: number, formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = actualizarBloqueOcupadoSchema.safeParse({ ...camposBase(formData), diaSemana: formData.get("diaSemana") });

  if (!parseo.success) {
    redirect(con(rutaSegura(formData, "origen"), "error", parseo.error.issues[0].message));
  }

  const actualizado = await disponibilidadService.actualizarBloqueOcupado(sesion.idUsuario, idBloqueOcupado, parseo.data);
  if (!actualizado) {
    redirect(con(rutaSegura(formData, "volverA"), "error", "Ese bloque ya no existe"));
  }

  revalidatePath("/calendario");
  redirect(con(rutaSegura(formData, "volverA"), "toast", "Bloque actualizado"));
}

export async function eliminarBloqueOcupadoAction(idBloqueOcupado: number, formData: FormData) {
  const sesion = await requerirSesion();
  await disponibilidadService.eliminarBloqueOcupado(sesion.idUsuario, idBloqueOcupado);
  revalidatePath("/calendario");
  redirect(con(rutaSegura(formData, "volverA"), "toast", "Bloque eliminado"));
}
