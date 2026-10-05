import { prisma } from "@/server/db/client";
import { horaATime } from "@/lib/dates";
import { ErrorDeNegocio } from "@/lib/errores";
import { intervalosDeLaSemana, type Intervalo } from "@/lib/disponibilidad";
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

/** Tiempo ocupado de varios usuarios (clases de cursos activos + bloques), solo como intervalos. */
export async function ocupadosDeUsuarios(idsUsuario: number[]): Promise<Map<number, Intervalo[]>> {
  const [horarios, bloques] = await Promise.all([
    prisma.horarioCurso.findMany({
      where: { curso: { idUsuario: { in: idsUsuario }, activo: true } },
      select: { diaSemana: true, horaInicio: true, horaFin: true, curso: { select: { idUsuario: true } } },
    }),
    prisma.bloqueOcupado.findMany({
      where: { idUsuario: { in: idsUsuario } },
      select: { idUsuario: true, diaSemana: true, horaInicio: true, horaFin: true },
    }),
  ]);

  const porUsuario = new Map<number, Intervalo[]>(idsUsuario.map((id) => [id, []]));
  for (const horario of horarios) porUsuario.get(horario.curso.idUsuario)?.push(...intervalosDeLaSemana([horario]));
  for (const bloque of bloques) porUsuario.get(bloque.idUsuario)?.push(...intervalosDeLaSemana([bloque]));
  return porUsuario;
}

/**
 * Horario semanal de un companero (decision del usuario: con categorias y cursos, como el propio
 * calendario). Solo si comparten un grupo donde ambos estan aceptados y ninguno es observador.
 * Los bloques van sin `detalle` (texto libre, puede ser personal). null si no puede verlo.
 */
export async function obtenerHorarioCompanero(idVisitante: number, idUsuario: number) {
  if (idVisitante === idUsuario) return null;
  const comparten = await prisma.grupo.findFirst({
    where: {
      AND: [
        { integrantes: { some: { idUsuario: idVisitante, estadoInvitacion: "aceptada", rol: { not: "observador" } } } },
        { integrantes: { some: { idUsuario, estadoInvitacion: "aceptada", rol: { not: "observador" } } } },
      ],
    },
    select: { idGrupo: true },
  });
  if (!comparten) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario },
    select: {
      nombre: true,
      apellidos: true,
      fotoUrl: true,
      eliminadoEn: true,
      cursos: {
        where: { activo: true },
        select: { nombre: true, horarios: { select: { idHorario: true, diaSemana: true, horaInicio: true, horaFin: true } } },
      },
      bloquesOcupados: { select: { idBloqueOcupado: true, tipo: true, diaSemana: true, horaInicio: true, horaFin: true } },
    },
  });
  if (!usuario || usuario.eliminadoEn) return null;

  return {
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    fotoUrl: usuario.fotoUrl,
    horarios: usuario.cursos.flatMap((curso) => curso.horarios.map((h) => ({ ...h, curso: curso.nombre }))),
    bloques: usuario.bloquesOcupados.map(({ tipo, ...bloque }) => ({
      ...bloque,
      categoria: tipo === "laboral" ? ("laboral" as const) : ("fam" as const),
    })),
  };
}

/**
 * Disponibilidad de los integrantes aceptados (sin observadores) de un grupo. Solo la ven
 * integrantes aceptados que no sean observadores (AGENTS.md 8.3: el observador no ve la
 * disponibilidad de nadie).
 */
export async function obtenerDisponibilidadGrupo(idUsuario: number, idGrupo: number) {
  const integrantes = await prisma.grupoIntegrante.findMany({
    where: { idGrupo, estadoInvitacion: "aceptada" },
    select: {
      idUsuario: true,
      rol: true,
      usuario: { select: { nombre: true, apellidos: true, fotoUrl: true } },
    },
    orderBy: { fechaInvitacion: "asc" },
  });

  const yo = integrantes.find((integrante) => integrante.idUsuario === idUsuario);
  if (!yo) throw new ErrorDeNegocio("Grupo no encontrado");
  if (yo.rol === "observador") throw new ErrorDeNegocio("Los observadores no ven la disponibilidad del grupo");

  const cuentan = integrantes.filter((integrante) => integrante.rol !== "observador");
  const ocupados = await ocupadosDeUsuarios(cuentan.map((integrante) => integrante.idUsuario));

  return cuentan.map((integrante) => ({
    idUsuario: integrante.idUsuario,
    nombre: integrante.usuario.nombre,
    apellidos: integrante.usuario.apellidos,
    fotoUrl: integrante.usuario.fotoUrl,
    ocupados: ocupados.get(integrante.idUsuario) ?? [],
  }));
}
