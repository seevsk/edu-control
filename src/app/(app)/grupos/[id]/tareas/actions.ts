"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import {
  crearTareaSchema,
  reasignarTareaSchema,
  contextoTareaSchema,
  cambiarEstadoTareaSchema,
  filtrosTareaSchema,
  idRegistroSchema,
  type DestinoTarea,
  type FiltrosTarea,
} from "@/lib/validation/tarea";
import * as tareaService from "@/server/services/tarea";
import { mensajeParaUsuario } from "@/lib/errores";

function leerFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function rutaTarea(idGrupo: number, idTarea: number, destino: DestinoTarea, filtros: FiltrosTarea = {}) {
  if (destino === "detalle") return `/grupos/${idGrupo}/tareas/${idTarea}`;
  const parametros = new URLSearchParams();
  if (destino === "tabla") parametros.set("vista", "lista");
  if (filtros.q) parametros.set("q", filtros.q);
  if (filtros.estado) parametros.set("estado", filtros.estado);
  if (filtros.asignado) parametros.set("asignado", String(filtros.asignado));
  if (filtros.foco) parametros.set("foco", filtros.foco);
  const consulta = parametros.toString();
  return `/grupos/${idGrupo}/tareas${consulta ? `?${consulta}` : ""}`;
}

function redirigirErrorTarea(ruta: string, mensaje: string): never {
  redirect(`${ruta}${ruta.includes("?") ? "&" : "?"}error=${encodeURIComponent(mensaje)}`);
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

  if (!parseo.success) {
    redirect(`/grupos/${idGrupo}/tareas?nueva=1&error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  try {
    await tareaService.crearTarea(sesion.idUsuario, grupoId.data, parseo.data);
  } catch (error) {
    redirect(`/grupos/${idGrupo}/tareas?nueva=1&error=${encodeURIComponent(mensajeParaUsuario(error, "No se pudo crear la tarea"))}`);
  }

  revalidatePath(`/grupos/${idGrupo}/tareas`);
  redirect(`/grupos/${idGrupo}/tareas?toast=${encodeURIComponent("Tarea creada")}`);
}

export async function reasignarTareaAction(
  idGrupo: number,
  idTarea: number,
  destino: DestinoTarea,
  filtros: FiltrosTarea,
  formData: FormData,
) {
  const sesion = await requerirSesion();
  const contexto = contextoTareaSchema.safeParse({ idGrupo, idTarea, destino });
  if (!contexto.success) redirect("/grupos");
  const filtrosValidados = filtrosTareaSchema.safeParse(filtros);
  const ruta = rutaTarea(
    contexto.data.idGrupo,
    contexto.data.idTarea,
    contexto.data.destino,
    filtrosValidados.success ? filtrosValidados.data : {},
  );
  const parseo = reasignarTareaSchema.safeParse(leerFormData(formData));
  if (!parseo.success) redirigirErrorTarea(ruta, parseo.error.issues[0].message);

  try {
    await tareaService.reasignarTarea(sesion.idUsuario, contexto.data.idGrupo, contexto.data.idTarea, parseo.data.idAsignado ?? "");
  } catch (error) {
    redirigirErrorTarea(ruta, mensajeParaUsuario(error, "No se pudo reasignar"));
  }

  revalidarTarea(idGrupo, idTarea);
  redirect(ruta);
}

export async function cambiarEstadoTareaAction(
  idGrupo: number,
  idTarea: number,
  nuevoEstado: "pendiente" | "en_progreso" | "en_revision" | "completada",
  destino: DestinoTarea,
  filtros: FiltrosTarea,
  formData: FormData,
) {
  const sesion = await requerirSesion();
  const contexto = cambiarEstadoTareaSchema.safeParse({ idGrupo, idTarea, nuevoEstado, destino });
  if (!contexto.success) redirect("/grupos");
  const filtrosValidados = filtrosTareaSchema.safeParse(filtros);
  const ruta = rutaTarea(
    contexto.data.idGrupo,
    contexto.data.idTarea,
    contexto.data.destino,
    filtrosValidados.success ? filtrosValidados.data : {},
  );

  try {
    await tareaService.cambiarEstadoTarea(
      sesion.idUsuario,
      contexto.data.idGrupo,
      contexto.data.idTarea,
      contexto.data.nuevoEstado,
      String(formData.get("motivoDevolucion") ?? ""),
    );
  } catch (error) {
    redirigirErrorTarea(ruta, mensajeParaUsuario(error, "No se pudo cambiar el estado"));
  }

  revalidarTarea(idGrupo, idTarea);
  redirect(ruta);
}
