"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import {
  crearCursoSchema,
  actualizarCursoSchema,
  crearHorarioSchema,
  actualizarHorarioCursoSchema,
  crearEvaluacionSchema,
} from "@/lib/validation/curso";
import * as cursoService from "@/server/services/curso";
import { mensajeParaUsuario } from "@/lib/errores";
import { ESTADOS_EVALUACION } from "@/lib/estado-evaluacion";
import { z } from "zod";

function leerFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function sincronizarCursoAction(idCurso: number) {
  const sesion = await requerirSesion();

  try {
    await cursoService.sincronizarCursoImportado(sesion.idUsuario, idCurso);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo actualizar");
    redirect(`/cursos/${idCurso}?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath(`/cursos/${idCurso}`);
  revalidatePath("/calendario");
  redirect(`/cursos/${idCurso}`);
}

export async function importarCursoAction(idGrupo: number, volverA: string) {
  const sesion = await requerirSesion();

  try {
    await cursoService.importarCursoDesdeGrupo(sesion.idUsuario, idGrupo);
  } catch (error) {
    const mensaje = mensajeParaUsuario(error, "No se pudo añadir el curso");
    redirect(`${volverA}?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath("/cursos");
  revalidatePath(volverA);
  revalidatePath("/calendario");
  const separador = volverA.includes("?") ? "&" : "?";
  redirect(`${volverA}${separador}toast=${encodeURIComponent("Curso añadido a tus cursos")}`);
}

export async function crearCursoAction(formData: FormData) {
  const sesion = await requerirSesion();
  const datos = { ...leerFormData(formData), dias: formData.getAll("dias") };
  const parseo = crearCursoSchema.safeParse(datos);

  if (!parseo.success) {
    redirect(`/cursos?nuevo=1&error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  const curso = await cursoService.crearCurso(sesion.idUsuario, parseo.data);
  revalidatePath("/cursos");
  revalidatePath("/calendario");
  redirect(`/cursos/${curso.idCurso}?nuevo=1`);
}

export async function actualizarCursoAction(idCurso: number, formData: FormData) {
  const sesion = await requerirSesion();
  const datos = leerFormData(formData);
  const parseo = actualizarCursoSchema.safeParse({
    ...datos,
    activo: datos.activo === "on",
  });

  if (!parseo.success) {
    redirect(`/cursos/${idCurso}?editar=1&error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  try {
    await cursoService.actualizarCurso(sesion.idUsuario, idCurso, parseo.data);
  } catch (error) {
    redirect(`/cursos/${idCurso}?editar=1&error=${encodeURIComponent(mensajeParaUsuario(error))}`);
  }
  revalidatePath(`/cursos/${idCurso}`);
  revalidatePath("/cursos");
  revalidatePath("/calendario");
  revalidatePath("/", "layout");
  redirect(`/cursos/${idCurso}?toast=${encodeURIComponent("Cambios guardados")}`);
}

export async function alternarActivoCursoAction(idCurso: number) {
  const sesion = await requerirSesion();

  try {
    await cursoService.alternarActivoCurso(sesion.idUsuario, idCurso);
  } catch (error) {
    redirect(`/cursos?error=${encodeURIComponent(mensajeParaUsuario(error))}`);
  }

  revalidatePath("/cursos");
  revalidatePath("/calendario");
  redirect(`/cursos?toast=${encodeURIComponent("Curso actualizado")}`);
}

export async function eliminarCursoAction(idCurso: number) {
  const sesion = await requerirSesion();

  try {
    await cursoService.eliminarCurso(sesion.idUsuario, idCurso);
  } catch (error) {
    redirect(`/cursos?error=${encodeURIComponent(mensajeParaUsuario(error))}`);
  }

  revalidatePath("/cursos");
  revalidatePath("/calendario");
  redirect(`/cursos?toast=${encodeURIComponent("Curso eliminado")}`);
}

export async function agregarHorarioAction(idCurso: number, formData: FormData) {
  const sesion = await requerirSesion();
  const datos = leerFormData(formData);
  const parseo = crearHorarioSchema.safeParse({
    dias: formData.getAll("dias"),
    horaInicio: datos.horaInicio,
    horaFin: datos.horaFin,
  });

  if (!parseo.success) {
    redirect(`/cursos/${idCurso}?error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  try {
    await cursoService.agregarHorario(sesion.idUsuario, idCurso, parseo.data);
  } catch (error) {
    redirect(`/cursos/${idCurso}?error=${encodeURIComponent(mensajeParaUsuario(error))}`);
  }
  revalidatePath(`/cursos/${idCurso}`);
  revalidatePath("/calendario");
  redirect(`/cursos/${idCurso}?toast=${encodeURIComponent("Horario configurado")}`);
}

export async function actualizarHorarioCursoAction(idCurso: number, idHorario: number, formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = actualizarHorarioCursoSchema.safeParse({
    diaSemana: formData.get("diaSemana"),
    horaInicio: formData.get("horaInicio"),
    horaFin: formData.get("horaFin"),
  });

  if (!parseo.success) {
    redirect(`/cursos/${idCurso}?sesion=${idHorario}&error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  try {
    await cursoService.actualizarHorarioCurso(sesion.idUsuario, idCurso, idHorario, parseo.data);
  } catch (error) {
    redirect(`/cursos/${idCurso}?error=${encodeURIComponent(mensajeParaUsuario(error))}`);
  }
  revalidatePath(`/cursos/${idCurso}`);
  revalidatePath("/calendario");
  redirect(`/cursos/${idCurso}?toast=${encodeURIComponent("Horario actualizado")}`);
}

export async function agregarEvaluacionAction(idCurso: number, formData: FormData) {
  const sesion = await requerirSesion();
  const datos = leerFormData(formData);
  const parseo = crearEvaluacionSchema.safeParse({
    nombre: datos.nombre,
    fechaApertura: datos.fechaApertura,
    fechaCierre: datos.fechaCierre,
    requiereEntrega: datos.requiereEntrega === "on",
  });

  if (!parseo.success) {
    redirect(`/cursos/${idCurso}?nuevaEvaluacion=1&error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  try {
    await cursoService.agregarEvaluacion(sesion.idUsuario, idCurso, parseo.data);
  } catch (error) {
    redirect(`/cursos/${idCurso}?nuevaEvaluacion=1&error=${encodeURIComponent(mensajeParaUsuario(error, "No se pudo agregar la evaluación"))}`);
  }
  revalidatePath(`/cursos/${idCurso}`);
  revalidatePath("/calendario");
  revalidatePath("/");
  redirect(`/cursos/${idCurso}?toast=${encodeURIComponent("Evaluación agregada")}`);
}

export async function eliminarEvaluacionAction(idCurso: number, idEvaluacion: number) {
  const sesion = await requerirSesion();
  try {
    await cursoService.eliminarEvaluacion(sesion.idUsuario, idCurso, idEvaluacion);
  } catch (error) {
    redirect(`/cursos/${idCurso}?error=${encodeURIComponent(mensajeParaUsuario(error, "No se pudo quitar la evaluación"))}`);
  }
  revalidatePath(`/cursos/${idCurso}`);
  revalidatePath("/calendario");
  revalidatePath("/");
  redirect(`/cursos/${idCurso}`);
}

function rutaEvaluacion(idCurso: number, idEvaluacion: number) {
  return `/cursos/${idCurso}?evaluacion=${idEvaluacion}`;
}

export async function marcarEvaluacionEntregadaAction(idCurso: number, idEvaluacion: number, entregada: boolean) {
  const sesion = await requerirSesion();
  try {
    await cursoService.marcarEvaluacionEntregada(sesion.idUsuario, idCurso, idEvaluacion, entregada);
  } catch (error) {
    redirect(`${rutaEvaluacion(idCurso, idEvaluacion)}&error=${encodeURIComponent(mensajeParaUsuario(error, "No se pudo guardar"))}`);
  }
  revalidatePath(`/cursos/${idCurso}`);
  revalidatePath("/");
  redirect(rutaEvaluacion(idCurso, idEvaluacion));
}

const cambioEstadoEvaluacionSchema = z.object({
  destino: z.enum(ESTADOS_EVALUACION),
  motivo: z.string().trim().max(500, "El motivo admite hasta 500 caracteres").optional(),
});

export async function cambiarEstadoEvaluacionAction(idCurso: number, idEvaluacion: number, formData: FormData) {
  const sesion = await requerirSesion();
  const parseo = cambioEstadoEvaluacionSchema.safeParse({
    destino: formData.get("destino"),
    motivo: formData.get("motivo") ?? undefined,
  });
  if (!parseo.success) {
    redirect(`${rutaEvaluacion(idCurso, idEvaluacion)}&error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }
  try {
    await cursoService.cambiarEstadoEvaluacion(sesion.idUsuario, idEvaluacion, parseo.data.destino, parseo.data.motivo);
  } catch (error) {
    redirect(`${rutaEvaluacion(idCurso, idEvaluacion)}&error=${encodeURIComponent(mensajeParaUsuario(error, "No se pudo cambiar el estado"))}`);
  }
  revalidatePath(`/cursos/${idCurso}`);
  revalidatePath("/");
  revalidatePath("/calendario");
  redirect(rutaEvaluacion(idCurso, idEvaluacion));
}

/** Se llama al abrir el detalle: registra la primera vista sin redirigir. */
export async function registrarVistaEvaluacionAction(idEvaluacion: number) {
  const sesion = await requerirSesion();
  await cursoService.registrarVistaEvaluacion(sesion.idUsuario, idEvaluacion).catch(() => undefined);
}
