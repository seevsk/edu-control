import { prisma } from "@/server/db/client";
import { horaATime } from "@/lib/dates";
import { cerrarSesion } from "@/server/auth/session";
import { requerirUsuarioValido } from "@/server/services/usuario";
import type { actualizarPerfilSchema, crearBloqueOcupadoSchema } from "@/lib/validation/perfil";
import type { z } from "zod";

export async function obtenerPerfilCompleto(idUsuario: number) {
  await requerirUsuarioValido(idUsuario);
  return prisma.usuario.findUniqueOrThrow({
    where: { idUsuario },
    include: { perfil: true, bloquesOcupados: { orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }] } },
  });
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

export async function crearBloqueOcupado(
  idUsuario: number,
  datos: z.infer<typeof crearBloqueOcupadoSchema>,
) {
  return prisma.bloqueOcupado.create({
    data: {
      idUsuario,
      tipo: datos.tipo,
      diaSemana: datos.diaSemana,
      horaInicio: horaATime(datos.horaInicio),
      horaFin: horaATime(datos.horaFin),
    },
  });
}

export async function eliminarBloqueOcupado(idUsuario: number, idBloqueOcupado: number) {
  await prisma.bloqueOcupado.deleteMany({ where: { idBloqueOcupado, idUsuario } });
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
