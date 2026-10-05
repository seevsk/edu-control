import { prisma } from "@/server/db/client";
import { cerrarSesion } from "@/server/auth/session";
import { requerirUsuarioValido } from "@/server/services/usuario";
import { ocupadosDeUsuarios } from "@/server/services/disponibilidad";
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
 * - El horario (solo ocupado/libre) se muestra si comparten un grupo donde ambos estan
 *   aceptados y ninguno es observador.
 * - Nunca se expone correo, `trabaja`, el tipo de un bloque ni el curso.
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
      perfil: {
        select: {
          tipoCuenta: true,
          institucion: true,
          carrera: true,
          ciclo: true,
          biografia: true,
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
      integrantes: { where: { idUsuario: { in: [idVisitante, idUsuario] } }, select: { rol: true } },
    },
    orderBy: { fechaCreacion: "desc" },
  });

  if (gruposEnComun.length === 0 && !usuario.perfil.visibleEnBusqueda) return null;

  const veHorario = gruposEnComun.some((grupo) => grupo.integrantes.every((i) => i.rol !== "observador"));
  const ocupados = veHorario ? ((await ocupadosDeUsuarios([idUsuario])).get(idUsuario) ?? []) : null;
  const { tipoCuenta, institucion, carrera, ciclo, biografia } = usuario.perfil;

  return {
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    fotoUrl: usuario.fotoUrl,
    perfil: { tipoCuenta, institucion, carrera, ciclo, biografia },
    gruposEnComun: gruposEnComun.map(({ idGrupo, nombre }) => ({ idGrupo, nombre })),
    ocupados,
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
export async function eliminarCuenta(idUsuario: number) {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { idUsuario } });
  const marcaAnonima = `eliminado-${idUsuario}-${Date.now()}@educontrol.local`;

  await prisma.$transaction([
    prisma.bloqueOcupado.deleteMany({ where: { idUsuario } }),
    prisma.perfil.delete({ where: { idUsuario } }),
    prisma.usuario.update({
      where: { idUsuario },
      data: {
        eliminadoEn: new Date(),
        nombre: "Cuenta eliminada",
        apellidos: null,
        correo: marcaAnonima,
        dominioCorreo: null,
        fotoUrl: null,
        googleId: `eliminado-${usuario.googleId}`,
      },
    }),
  ]);

  await cerrarSesion();
}
