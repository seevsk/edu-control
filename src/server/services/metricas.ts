import { prisma } from "@/server/db/client";
import { calcularAvanceGrupo, calcularMetricasPorIntegrante, calcularPuntualidad } from "@/lib/metricas";

async function requerirIntegranteActivo(idUsuario: number, idGrupo: number) {
  const integrante = await prisma.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
  });
  if (!integrante || integrante.estadoInvitacion !== "aceptada") {
    throw new Error("No eres integrante de este grupo");
  }
}

/** Excluye observadores de todas las metricas. Sin ranking: carga y cumplimiento van lado a lado. */
export async function obtenerMetricasGrupo(idUsuario: number, idGrupo: number) {
  await requerirIntegranteActivo(idUsuario, idGrupo);

  const [tareas, historial, integrantesElegibles] = await Promise.all([
    prisma.tarea.findMany({ where: { idGrupo } }),
    prisma.tareaHistorial.findMany({ where: { tarea: { idGrupo } } }),
    prisma.grupoIntegrante.findMany({
      where: { idGrupo, estadoInvitacion: "aceptada", rol: { not: "observador" } },
      include: { usuario: true },
      orderBy: { usuario: { nombre: "asc" } },
    }),
  ]);

  const avance = calcularAvanceGrupo(tareas);
  const metricasBase = calcularMetricasPorIntegrante(
    tareas,
    integrantesElegibles.map((i) => i.idUsuario),
  );

  const porIntegrante = integrantesElegibles.map((integrante) => {
    const metrica = metricasBase.find((m) => m.idUsuario === integrante.idUsuario)!;
    return {
      idUsuario: integrante.idUsuario,
      nombre: integrante.usuario.nombre,
      apellidos: integrante.usuario.apellidos,
      fotoUrl: integrante.usuario.fotoUrl,
      carga: metrica.carga,
      cumplimiento: metrica.cumplimiento,
      puntualidad: calcularPuntualidad(tareas, historial, integrante.idUsuario),
    };
  });

  return { avance, porIntegrante };
}

/** Feed de actividad = lectura de tarea_historial. No lleva tabla propia. */
export async function obtenerFeedActividad(idUsuario: number, idGrupo: number, limite = 40) {
  await requerirIntegranteActivo(idUsuario, idGrupo);

  return prisma.tareaHistorial.findMany({
    where: { tarea: { idGrupo } },
    include: { usuario: true, tarea: true },
    orderBy: { fecha: "desc" },
    take: limite,
  });
}
