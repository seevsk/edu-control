"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import {
  crearTareaSchema,
  editarTareaSchema,
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
import type { EstadoTarea } from "@/lib/estado-tarea";

function leerFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

/** Vuelve directo a la vista actual (/grupos/[id], con el detalle en ?tarea=), sin pasar por las rutas antiguas. */
function rutaTarea(idGrupo: number, idTarea: number, destino: DestinoTarea, filtros: FiltrosTarea = {}) {
  const parametros = new URLSearchParams();
  if (destino === "detalle") parametros.set("tarea", String(idTarea));
  if (filtros.estado) parametros.set("estado", filtros.estado);
  if (filtros.asignado) parametros.set("asignado", String(filtros.asignado));
  const consulta = parametros.toString();
  return `/grupos/${idGrupo}${consulta ? `?${consulta}` : ""}`;
}

/** Agrega un parámetro respetando si la ruta ya tiene consulta. */
function conParametro(ruta: string, clave: string, valor: string) {
  return `${ruta}${ruta.includes("?") ? "&" : "?"}${clave}=${encodeURIComponent(valor)}`;
}

function redirigirErrorTarea(ruta: string, mensaje: string): never {
  redirect(conParametro(ruta, "error", mensaje));
}

function revalidarTarea(idGrupo: number) {
  revalidatePath(`/grupos/${idGrupo}`);
  revalidatePath(`/grupos/${idGrupo}/tareas`);
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
    redirect(`/grupos/${idGrupo}?nueva=1&error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  try {
    await tareaService.crearTarea(sesion.idUsuario, grupoId.data, parseo.data);
  } catch (error) {
    redirect(`/grupos/${idGrupo}?nueva=1&error=${encodeURIComponent(mensajeParaUsuario(error, "No se pudo crear la tarea"))}`);
  }

  revalidatePath(`/grupos/${idGrupo}`);
  redirect(`/grupos/${idGrupo}?toast=${encodeURIComponent("Tarea creada")}`);
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

  revalidarTarea(idGrupo);
  redirect(ruta);
}

/** "Tomar tarea": el integrante se asigna a si mismo una tarea pendiente sin responsable. */
export async function tomarTareaAction(idGrupo: number, idTarea: number, destino: DestinoTarea, filtros: FiltrosTarea) {
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

  try {
    await tareaService.tomarTarea(sesion.idUsuario, contexto.data.idGrupo, contexto.data.idTarea);
  } catch (error) {
    redirigirErrorTarea(ruta, mensajeParaUsuario(error, "No se pudo tomar la tarea"));
  }

  revalidarTarea(idGrupo);
  redirect(conParametro(ruta, "toast", "Tarea tomada"));
}

export async function cambiarEstadoTareaAction(
  idGrupo: number,
  idTarea: number,
  nuevoEstado: EstadoTarea,
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
      String(formData.get("motivo") ?? ""),
    );
  } catch (error) {
    redirigirErrorTarea(ruta, mensajeParaUsuario(error, "No se pudo cambiar el estado"));
  }

  revalidarTarea(idGrupo);
  redirect(ruta);
}

/** Movimiento desde el tablero: mismas reglas e historial que el boton, pero sin redirigir. */
export async function moverTareaAction(
  idGrupo: number,
  idTarea: number,
  nuevoEstado: EstadoTarea,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sesion = await requerirSesion();
  const contexto = cambiarEstadoTareaSchema.safeParse({ idGrupo, idTarea, nuevoEstado, destino: "lista" });
  if (!contexto.success) return { ok: false, error: "Movimiento no válido" };
  try {
    await tareaService.cambiarEstadoTarea(sesion.idUsuario, contexto.data.idGrupo, contexto.data.idTarea, contexto.data.nuevoEstado);
  } catch (error) {
    return { ok: false, error: mensajeParaUsuario(error, "No se pudo mover la tarea") };
  }
  revalidarTarea(contexto.data.idGrupo);
  return { ok: true };
}

export async function editarTareaAction(idGrupo: number, idTarea: number, formData: FormData) {
  const sesion = await requerirSesion();
  const contexto = contextoTareaSchema.safeParse({ idGrupo, idTarea, destino: "detalle" });
  if (!contexto.success) redirect("/grupos");
  const ruta = rutaTarea(contexto.data.idGrupo, contexto.data.idTarea, "detalle");
  const parseo = editarTareaSchema.safeParse(leerFormData(formData));
  if (!parseo.success) redirigirErrorTarea(conParametro(ruta, "editar", "1"), parseo.error.issues[0].message);

  try {
    await tareaService.editarTarea(sesion.idUsuario, contexto.data.idGrupo, contexto.data.idTarea, parseo.data);
  } catch (error) {
    redirigirErrorTarea(conParametro(ruta, "editar", "1"), mensajeParaUsuario(error, "No se pudo guardar la tarea"));
  }

  revalidarTarea(idGrupo);
  redirect(conParametro(ruta, "toast", "Tarea actualizada"));
}

/** Se llama al abrir el detalle; nunca muestra errores porque es solo un registro de seguimiento. */
export async function registrarVistaTareaAction(idGrupo: number, idTarea: number) {
  const sesion = await requerirSesion();
  const contexto = contextoTareaSchema.safeParse({ idGrupo, idTarea, destino: "detalle" });
  if (!contexto.success) return;
  try {
    await tareaService.registrarVistaTarea(sesion.idUsuario, contexto.data.idGrupo, contexto.data.idTarea);
  } catch {
    return;
  }
  revalidatePath(`/grupos/${idGrupo}`);
}
