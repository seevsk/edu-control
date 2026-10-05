import { prisma } from "@/server/db/client";
import { horaATime } from "@/lib/dates";
import type { actualizarBloqueOcupadoSchema, crearBloqueOcupadoSchema } from "@/lib/validation/disponibilidad";
import type { z } from "zod";

/** Crea un bloque por cada dia elegido. Devuelve cuantos se crearon. */
export async function crearBloquesOcupados(
  idUsuario: number,
  datos: z.infer<typeof crearBloqueOcupadoSchema>,
) {
  const dias = [...new Set(datos.dias)];
  const { count } = await prisma.bloqueOcupado.createMany({
    data: dias.map((diaSemana) => ({
      idUsuario,
      tipo: datos.tipo,
      diaSemana,
      horaInicio: horaATime(datos.horaInicio),
      horaFin: horaATime(datos.horaFin),
      detalle: datos.detalle || null,
    })),
  });
  return count;
}

/** Solo devuelve el bloque si es del usuario de la sesion. */
export async function obtenerBloqueOcupado(idUsuario: number, idBloqueOcupado: number) {
  return prisma.bloqueOcupado.findFirst({ where: { idBloqueOcupado, idUsuario } });
}

/** Devuelve false si el bloque no existe o no es del usuario. */
export async function actualizarBloqueOcupado(
  idUsuario: number,
  idBloqueOcupado: number,
  datos: z.infer<typeof actualizarBloqueOcupadoSchema>,
) {
  const { count } = await prisma.bloqueOcupado.updateMany({
    where: { idBloqueOcupado, idUsuario },
    data: {
      tipo: datos.tipo,
      diaSemana: datos.diaSemana,
      horaInicio: horaATime(datos.horaInicio),
      horaFin: horaATime(datos.horaFin),
      detalle: datos.detalle || null,
    },
  });
  return count > 0;
}

export async function eliminarBloqueOcupado(idUsuario: number, idBloqueOcupado: number) {
  await prisma.bloqueOcupado.deleteMany({ where: { idBloqueOcupado, idUsuario } });
}
