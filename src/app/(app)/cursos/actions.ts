"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import {
  crearCursoSchema,
  actualizarCursoSchema,
  crearHorarioSchema,
  crearEvaluacionSchema,
} from "@/lib/validation/curso";
import * as cursoService from "@/server/services/curso";

function leerFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function crearCursoAction(formData: FormData) {
  const sesion = await requerirSesion();
  const datos = leerFormData(formData);
  const parseo = crearCursoSchema.safeParse(datos);

  if (!parseo.success) {
    redirect(`/cursos?error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  await cursoService.crearCurso(sesion.idUsuario, parseo.data);
  revalidatePath("/cursos");
  redirect("/cursos");
}

export async function actualizarCursoAction(idCurso: number, formData: FormData) {
  const sesion = await requerirSesion();
  const datos = leerFormData(formData);
  const parseo = actualizarCursoSchema.safeParse({
    ...datos,
    activo: datos.activo === "on",
  });

  if (!parseo.success) {
    redirect(`/cursos/${idCurso}?error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  await cursoService.actualizarCurso(sesion.idUsuario, idCurso, parseo.data);
  revalidatePath(`/cursos/${idCurso}`);
  revalidatePath("/cursos");
  redirect(`/cursos/${idCurso}`);
}

export async function agregarHorarioAction(idCurso: number, formData: FormData) {
  const sesion = await requerirSesion();
  const datos = leerFormData(formData);
  const parseo = crearHorarioSchema.safeParse({
    diaSemana: Number(datos.diaSemana),
    horaInicio: datos.horaInicio,
    horaFin: datos.horaFin,
  });

  if (!parseo.success) {
    redirect(`/cursos/${idCurso}?error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  await cursoService.agregarHorario(sesion.idUsuario, idCurso, parseo.data);
  revalidatePath(`/cursos/${idCurso}`);
  redirect(`/cursos/${idCurso}`);
}

export async function eliminarHorarioAction(idCurso: number, idHorario: number) {
  const sesion = await requerirSesion();
  await cursoService.eliminarHorario(sesion.idUsuario, idCurso, idHorario);
  revalidatePath(`/cursos/${idCurso}`);
  redirect(`/cursos/${idCurso}`);
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
    redirect(`/cursos/${idCurso}?error=${encodeURIComponent(parseo.error.issues[0].message)}`);
  }

  await cursoService.agregarEvaluacion(sesion.idUsuario, idCurso, parseo.data);
  revalidatePath(`/cursos/${idCurso}`);
  redirect(`/cursos/${idCurso}`);
}

export async function eliminarEvaluacionAction(idCurso: number, idEvaluacion: number) {
  const sesion = await requerirSesion();
  await cursoService.eliminarEvaluacion(sesion.idUsuario, idCurso, idEvaluacion);
  revalidatePath(`/cursos/${idCurso}`);
  redirect(`/cursos/${idCurso}`);
}

export async function marcarEvaluacionEntregadaAction(idCurso: number, idEvaluacion: number) {
  const sesion = await requerirSesion();
  await cursoService.marcarEvaluacionEntregada(sesion.idUsuario, idCurso, idEvaluacion);
  revalidatePath(`/cursos/${idCurso}`);
  redirect(`/cursos/${idCurso}`);
}
