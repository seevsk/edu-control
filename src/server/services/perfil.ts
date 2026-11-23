import { prisma } from "@/server/db/client";
import { requerirUsuarioValido } from "@/server/services/usuario";
import { ejecutarCambioDeGrupo } from "@/server/services/cambio-grupo";
import { notificarSalidaDelGrupo, salirDelGrupoEnTransaccion } from "@/server/services/grupo";
import { ErrorDeNegocio } from "@/lib/errores";
import type { actualizarPerfilSchema } from "@/lib/validation/perfil";
import type { z } from "zod";

export async function obtenerPerfilCompleto(idUsuario: number) {
  await requerirUsuarioValido(idUsuario);
  return prisma.usuario.findUniqueOrThrow({
    where: { idUsuario },
    include: { perfil: true },
  });
}

/**
 * Perfil de otro usuario. Reglas (decididas con el usuario):
 * - Cualquiera lo ve solo si la persona tiene `visible_en_busqueda`; sus companeros de grupo
 *   (ambos con invitacion aceptada) lo ven siempre.
 * - Datos basicos, incluido si trabaja. Nunca el correo.
 * - La disponibilidad va en su propia pagina; aqui solo se dice si el visitante puede verla.
 * Devuelve null si no existe, fue eliminado o no es visible para quien lo pide.
 */
export async function obtenerPerfilPublico(idVisitante: number, idUsuario: number) {
  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario },
    select: {
      idUsuario: true,
      nombre: true,
      apellidos: true,
      fotoUrl: true,
      eliminadoEn: true,
      fechaRegistro: true,
      perfil: {
        select: {
          tipoCuenta: true,
          institucion: true,
          carrera: true,
          ciclo: true,
          biografia: true,
          trabaja: true,
          visibleEnBusqueda: true,
        },
      },
    },
  });
  if (!usuario || usuario.eliminadoEn || !usuario.perfil) return null;

  const gruposEnComun = await prisma.grupo.findMany({
    where: {
      AND: [
        { integrantes: { some: { idUsuario: idVisitante, estadoInvitacion: "aceptada" } } },
        { integrantes: { some: { idUsuario, estadoInvitacion: "aceptada" } } },
      ],
    },
    select: {
      idGrupo: true,
      nombre: true,
      estado: true,
      evaluacion: { select: { curso: { select: { idCurso: true, nombre: true } } } },
      integrantes: { where: { idUsuario: { in: [idVisitante, idUsuario] } }, select: { idUsuario: true, rol: true } },
    },
    orderBy: { fechaCreacion: "desc" },
  });

  if (gruposEnComun.length === 0 && !usuario.perfil.visibleEnBusqueda) return null;

  const { tipoCuenta, institucion, carrera, ciclo, biografia, trabaja } = usuario.perfil;

  return {
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    fotoUrl: usuario.fotoUrl,
    perfil: { tipoCuenta, institucion, carrera, ciclo, biografia, trabaja },
    gruposEnComun: gruposEnComun.map((grupo) => ({
      idGrupo: grupo.idGrupo,
      nombre: grupo.nombre,
      activo: grupo.estado === "activo",
      curso: grupo.evaluacion?.curso ?? null,
      // Rol de la persona visitada en ese grupo.
      rol: grupo.integrantes.find((integrante) => integrante.idUsuario === idUsuario)?.rol ?? "miembro",
    })),
    fechaRegistro: usuario.fechaRegistro,
    puedeVerDisponibilidad: gruposEnComun.some((grupo) => grupo.integrantes.every((i) => i.rol !== "observador")),
  };
}

export async function actualizarPerfil(idUsuario: number, datos: z.infer<typeof actualizarPerfilSchema>) {
  await prisma.$transaction([
    prisma.usuario.update({
      where: { idUsuario },
      data: { nombre: datos.nombre, apellidos: datos.apellidos || null },
    }),
    prisma.perfil.update({
      where: { idUsuario },
      data: {
        tipoCuenta: datos.tipoCuenta,
        institucion: datos.institucion || null,
        carrera: datos.carrera || null,
        ciclo: datos.ciclo || null,
        biografia: datos.biografia || null,
        trabaja: datos.trabaja,
        visibleEnBusqueda: datos.visibleEnBusqueda,
      },
    }),
  ]);
}

/**
 * Eliminar cuenta = anonimizar (AGENTS.md 8.1): nunca se borra la fila de usuario. Se vacian
 * nombre/apellidos/correo/foto, se borran perfil y bloque_ocupado, y se conservan tarea y
 * tarea_historial para no romper los grupos de los que fue parte.
 */
/** Preferencia de privacidad que se guarda al instante desde la vista de lectura. */
export async function actualizarVisibilidad(idUsuario: number, visibleEnBusqueda: boolean) {
  await requerirUsuarioValido(idUsuario);
  await prisma.perfil.update({ where: { idUsuario }, data: { visibleEnBusqueda } });
}

/**
 * Antes de anonimizar, la persona sale de sus grupos activos como en "salir del grupo" (retirado
 * voluntario, tareas abiertas sin responsable) y sus invitaciones pendientes se cancelan: nadie
 * las respondió, así que no figuran como rechazos. Si lidera un grupo activo con otro integrante
 * que pueda liderar, se bloquea hasta que ceda el liderazgo. Es idempotente.
 */
export async function eliminarCuenta(idUsuario: number) {
  const salidas = await ejecutarCambioDeGrupo(async (tx) => {
    const usuario = await tx.usuario.findUnique({ where: { idUsuario } });
    if (!usuario || usuario.eliminadoEn) return null;

    const membresias = await tx.grupoIntegrante.findMany({
      where: { idUsuario, estadoInvitacion: "aceptada", grupo: { estado: "activo" } },
      include: { grupo: { select: { idGrupo: true, nombre: true } } },
    });
    const sinLider = new Set<number>();
    const bloqueantes: string[] = [];
    for (const membresia of membresias) {
      if (membresia.rol !== "lider") continue;
      const otros = await tx.grupoIntegrante.count({
        where: { idGrupo: membresia.idGrupo, idUsuario: { not: idUsuario }, estadoInvitacion: "aceptada", rol: { not: "observador" } },
      });
      if (otros > 0) bloqueantes.push(membresia.grupo.nombre);
      else sinLider.add(membresia.idGrupo);
    }
    if (bloqueantes.length > 0) throw new ErrorDeNegocio(`Cede el liderazgo en: ${bloqueantes.join(", ")}`);

    const salidas = [];
    for (const membresia of membresias) {
      salidas.push(await salirDelGrupoEnTransaccion(tx, idUsuario, membresia.idGrupo, { sinLider: sinLider.has(membresia.idGrupo) }));
    }
    await tx.grupoIntegrante.updateMany({
      where: { idUsuario, estadoInvitacion: "pendiente" },
      data: { estadoInvitacion: "cancelada" },
    });

    await tx.bloqueOcupado.deleteMany({ where: { idUsuario } });
    await tx.perfil.deleteMany({ where: { idUsuario } });
    await tx.usuario.update({
      where: { idUsuario },
      data: {
        eliminadoEn: new Date(),
        nombre: "Cuenta eliminada",
        apellidos: null,
        correo: `eliminado-${idUsuario}-${Date.now()}@educontrol.local`,
        dominioCorreo: null,
        fotoUrl: null,
        googleId: `eliminado-${usuario.googleId}`,
      },
    });
    return { persona: { nombre: usuario.nombre, apellidos: usuario.apellidos }, salidas };
  });

  if (salidas) {
    for (const salida of salidas.salidas) await notificarSalidaDelGrupo(salidas.persona, idUsuario, salida);
  }
}
