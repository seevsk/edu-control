import { prisma } from "@/server/db/client";

export async function listarNotificaciones(idUsuario: number, limite = 30) {
  return prisma.notificacion.findMany({
    where: { idUsuario },
    orderBy: { fechaCreacion: "desc" },
    take: limite,
  });
}

export async function contarNotificacionesNoLeidas(idUsuario: number) {
  return prisma.notificacion.count({ where: { idUsuario, leida: false } });
}

export async function marcarNotificacionLeida(idUsuario: number, idNotificacion: number) {
  await prisma.notificacion.updateMany({
    where: { idNotificacion, idUsuario },
    data: { leida: true },
  });
}

export async function marcarTodasLeidas(idUsuario: number) {
  await prisma.notificacion.updateMany({
    where: { idUsuario, leida: false },
    data: { leida: true },
  });
}
