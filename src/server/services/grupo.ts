import { prisma } from "@/server/db/client";
import { crearNotificacion } from "@/server/notifications/crear-notificacion";
import { plantillasNotificacion } from "@/server/notifications/templates";
import { ErrorDeNegocio } from "@/lib/errores";
import type { crearGrupoSchema, actualizarGrupoSchema } from "@/lib/validation/grupo";
import type { z } from "zod";

const LIMITE_RESULTADOS_BUSQUEDA = 8;
const MIN_CARACTERES_BUSQUEDA = 3;
const LIMITE_INVITACIONES_POR_HORA = 20;

export async function listarMisGrupos(idUsuario: number) {
  return prisma.grupo.findMany({
    where: { integrantes: { some: { idUsuario, estadoInvitacion: "aceptada" } } },
    include: {
      integrantes: { include: { usuario: true }, orderBy: { fechaInvitacion: "asc" } },
      evaluacion: { include: { curso: { select: { nombre: true, codigo: true, modalidad: true } } } },
    },
    orderBy: { fechaCreacion: "desc" },
  });
}

export async function listarInvitacionesPendientes(idUsuario: number) {
  return prisma.grupoIntegrante.findMany({
    where: { idUsuario, estadoInvitacion: "pendiente" },
    include: { grupo: { include: { creador: true } } },
    orderBy: { fechaInvitacion: "desc" },
  });
}

/** Lanza si el grupo no existe o el usuario no es integrante aceptado: solo integrantes ven un grupo. */
export async function obtenerGrupoDelUsuario(idUsuario: number, idGrupo: number) {
  const grupo = await prisma.grupo.findUnique({
    where: { idGrupo },
    include: {
      integrantes: { include: { usuario: true }, orderBy: { fechaInvitacion: "asc" } },
      evaluacion: { include: { curso: true } },
    },
  });

  const integrante = grupo?.integrantes.find(
    (i) => i.idUsuario === idUsuario && i.estadoInvitacion === "aceptada",
  );
  if (!grupo || !integrante) throw new ErrorDeNegocio("Grupo no encontrado");

  return { grupo, rolActual: integrante.rol };
}

async function requerirLiderDelGrupo(idUsuario: number, idGrupo: number) {
  const integrante = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    include: { grupo: true },
  });
  if (!integrante || integrante.estadoInvitacion !== "aceptada" || integrante.rol !== "lider") {
    throw new ErrorDeNegocio("Solo el lider del grupo puede hacer esto");
  }
  return integrante.grupo;
}

export async function crearGrupo(idUsuario: number, datos: z.infer<typeof crearGrupoSchema>) {
  let fechaLimite: Date | null = null;
  let idEvaluacion: number | null = null;

  if (datos.idEvaluacion) {
    const evaluacion = await prisma.evaluacion.findFirst({
      where: { idEvaluacion: Number(datos.idEvaluacion), curso: { idUsuario } },
    });
    if (evaluacion) {
      idEvaluacion = evaluacion.idEvaluacion;
      fechaLimite = evaluacion.fechaCierre;
    }
  }

  return prisma.grupo.create({
    data: {
      idCreador: idUsuario,
      nombre: datos.nombre,
      descripcion: datos.descripcion || null,
      idEvaluacion,
      fechaLimite,
      enlaceTrabajo: datos.enlaceTrabajo || null,
      integrantes: {
        create: [{ idUsuario, rol: "lider", estadoInvitacion: "aceptada", fechaRespuesta: new Date() }],
      },
    },
  });
}

export async function actualizarGrupo(
  idUsuario: number,
  idGrupo: number,
  datos: z.infer<typeof actualizarGrupoSchema>,
) {
  await requerirLiderDelGrupo(idUsuario, idGrupo);
  return prisma.grupo.update({
    where: { idGrupo },
    data: {
      nombre: datos.nombre,
      descripcion: datos.descripcion || null,
      enlaceTrabajo: datos.enlaceTrabajo || null,
      estado: datos.estado,
    },
  });
}

/** No se muestran datos de disponibilidad: solo nombre, correo y a que otros grupos ya pertenece no se expone. */
export async function buscarUsuarios(idUsuarioActual: number, consulta: string) {
  const texto = consulta.trim();
  if (!texto) return [];

  const esCorreo = texto.includes("@");
  if (!esCorreo && texto.length < MIN_CARACTERES_BUSQUEDA) return [];

  return prisma.usuario.findMany({
    where: {
      idUsuario: { not: idUsuarioActual },
      eliminadoEn: null,
      perfil: { visibleEnBusqueda: true },
      ...(esCorreo
        ? { correo: texto.toLowerCase() }
        : {
            OR: [
              { nombre: { contains: texto, mode: "insensitive" } },
              { apellidos: { contains: texto, mode: "insensitive" } },
            ],
          }),
    },
    select: { idUsuario: true, nombre: true, apellidos: true, correo: true, fotoUrl: true },
    take: LIMITE_RESULTADOS_BUSQUEDA,
  });
}

/** Buscador general de personas: mismas reglas que buscarUsuarios, pero sin correo (perfil publico). */
export async function buscarPersonas(idUsuarioActual: number, consulta: string) {
  const encontrados = await buscarUsuarios(idUsuarioActual, consulta);
  if (encontrados.length === 0) return [];

  const perfiles = await prisma.perfil.findMany({
    where: { idUsuario: { in: encontrados.map((u) => u.idUsuario) } },
    select: { idUsuario: true, carrera: true, institucion: true },
  });
  const porUsuario = new Map(perfiles.map((p) => [p.idUsuario, p]));

  return encontrados.map(({ idUsuario, nombre, apellidos, fotoUrl }) => ({
    idUsuario,
    nombre,
    apellidos,
    fotoUrl,
    carrera: porUsuario.get(idUsuario)?.carrera ?? null,
    institucion: porUsuario.get(idUsuario)?.institucion ?? null,
  }));
}

export async function invitarIntegrante(idActor: number, idGrupo: number, idUsuarioInvitado: number) {
  const grupo = await requerirLiderDelGrupo(idActor, idGrupo);
  if (grupo.estado !== "activo") throw new ErrorDeNegocio("El grupo esta finalizado");

  const invitacionesUltimaHora = await prisma.grupoIntegrante.count({
    where: {
      grupo: { idCreador: idActor },
      fechaInvitacion: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (invitacionesUltimaHora >= LIMITE_INVITACIONES_POR_HORA) {
    throw new ErrorDeNegocio("Llegaste al limite de invitaciones por hora, intenta mas tarde");
  }

  const invitado = await prisma.usuario.findUnique({ where: { idUsuario: idUsuarioInvitado } });
  if (!invitado || invitado.eliminadoEn) throw new ErrorDeNegocio("Usuario no encontrado");

  const yaEsIntegrante = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario: idUsuarioInvitado } },
  });
  if (yaEsIntegrante) throw new ErrorDeNegocio("Esa persona ya fue invitada a este grupo antes");

  const integrante = await prisma.grupoIntegrante.create({
    data: { idGrupo, idUsuario: idUsuarioInvitado, rol: "miembro", estadoInvitacion: "pendiente" },
  });

  await crearNotificacion({
    idUsuario: idUsuarioInvitado,
    tipo: "invitacion_grupo",
    ...plantillasNotificacion.invitacionGrupo(grupo.nombre),
  });

  return integrante;
}

export async function responderInvitacion(
  idUsuario: number,
  idGrupo: number,
  respuesta: "aceptada" | "rechazada",
) {
  const integrante = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    include: { grupo: true },
  });
  if (!integrante || integrante.estadoInvitacion !== "pendiente") {
    throw new ErrorDeNegocio("No tienes una invitacion pendiente a ese grupo");
  }

  await prisma.grupoIntegrante.update({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    data: { estadoInvitacion: respuesta, fechaRespuesta: new Date() },
  });

  await crearNotificacion({
    idUsuario: integrante.grupo.idCreador,
    tipo: "invitacion_respondida",
    ...plantillasNotificacion.invitacionRespondida(integrante.grupo.nombre, idGrupo, respuesta),
  });
}

export async function retirarIntegrante(idActor: number, idGrupo: number, idUsuarioObjetivo: number) {
  await requerirLiderDelGrupo(idActor, idGrupo);

  const objetivo = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario: idUsuarioObjetivo } },
  });
  if (!objetivo || objetivo.estadoInvitacion === "retirado") {
    throw new ErrorDeNegocio("Esa persona no es integrante del grupo");
  }
  if (objetivo.rol === "lider") throw new ErrorDeNegocio("El lider no se puede retirar a si mismo");

  await prisma.$transaction([
    prisma.grupoIntegrante.update({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario: idUsuarioObjetivo } },
      data: { estadoInvitacion: "retirado" },
    }),
    prisma.tarea.updateMany({
      where: { idGrupo, idAsignado: idUsuarioObjetivo, estado: { not: "completada" } },
      data: { idAsignado: null },
    }),
  ]);
}
