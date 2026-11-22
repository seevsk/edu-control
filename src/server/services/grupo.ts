import { prisma } from "@/server/db/client";
import { crearNotificacion } from "@/server/notifications/crear-notificacion";
import { plantillasNotificacion } from "@/server/notifications/templates";
import { ErrorDeNegocio } from "@/lib/errores";
import { finDeDiaLimaAUtc } from "@/lib/dates";
import { fechaEnZonaLimaISO } from "@/lib/calendario";
import { ESTADOS_TAREA_ABIERTOS } from "@/lib/estado-tarea";
import { nombreCorto } from "@/lib/nombres";
import { Prisma } from "../../../generated/prisma/client";
import { ejecutarCambioDeGrupo } from "./cambio-grupo";
import type { crearGrupoSchema, actualizarGrupoSchema } from "@/lib/validation/grupo";
import type { z } from "zod";

const LIMITE_RESULTADOS_BUSQUEDA = 8;
const MIN_CARACTERES_BUSQUEDA = 3;
const MAX_PALABRAS_BUSQUEDA = 4;
const LIMITE_INVITACIONES_POR_HORA = 20;

export async function listarMisGrupos(idUsuario: number) {
  return prisma.grupo.findMany({
    where: { integrantes: { some: { idUsuario, estadoInvitacion: "aceptada" } } },
    include: {
      integrantes: { include: { usuario: true }, orderBy: { fechaInvitacion: "asc" } },
      evaluacion: { include: { curso: { select: { idCurso: true, nombre: true, codigo: true, modalidad: true } } } },
      tareas: {
        select: { idTarea: true, peso: true, estado: true, idAsignado: true, fechaLimite: true },
      },
    },
    orderBy: { fechaCreacion: "desc" },
  });
}

/** Historial de invitaciones respondidas y retiros del usuario (no incluye los grupos que creó). */
export async function listarHistorialInvitaciones(idUsuario: number) {
  return prisma.grupoIntegrante.findMany({
    // Una invitación cancelada antes de responderla no entra al historial de quien la recibió.
    where: {
      idUsuario,
      estadoInvitacion: { notIn: ["pendiente", "cancelada"] },
      // Los grupos que creó no cuentan, salvo su propia salida.
      OR: [{ grupo: { idCreador: { not: idUsuario } } }, { estadoInvitacion: "retirado" }],
    },
    include: {
      invitador: { select: { idUsuario: true, nombre: true, apellidos: true, fotoUrl: true } },
      grupo: { select: { idGrupo: true, nombre: true, estado: true, evaluacion: { select: { nombre: true, curso: { select: { idCurso: true, nombre: true } } } } } },
    },
    orderBy: [{ fechaRetiro: { sort: "desc", nulls: "last" } }, { fechaRespuesta: "desc" }],
  });
}

export async function listarInvitacionesPendientes(idUsuario: number) {
  return prisma.grupoIntegrante.findMany({
    where: { idUsuario, estadoInvitacion: "pendiente" },
    include: {
      grupo: { include: { creador: true, evaluacion: { select: { nombre: true, curso: { select: { idCurso: true, nombre: true } } } } } },
      invitador: { select: { idUsuario: true, nombre: true, apellidos: true, fotoUrl: true } },
    },
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

async function requerirLiderDelGrupo(idUsuario: number, idGrupo: number, tx: Prisma.TransactionClient) {
  const integrante = await tx.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    include: { grupo: true },
  });
  if (!integrante || integrante.estadoInvitacion !== "aceptada" || integrante.rol !== "lider") {
    throw new ErrorDeNegocio("Solo el lider del grupo puede hacer esto");
  }
  if (integrante.grupo.estado !== "activo") {
    throw new ErrorDeNegocio("El grupo está finalizado y es de solo lectura");
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
    if (!evaluacion) throw new ErrorDeNegocio("La evaluación elegida no existe");
    if (evaluacion.fechaCierre < new Date()) throw new ErrorDeNegocio("Esa evaluación ya cerró, elige una vigente");
    idEvaluacion = evaluacion.idEvaluacion;
    fechaLimite = evaluacion.fechaCierre;
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
  return ejecutarCambioDeGrupo(async (tx) => {
    const grupo = await requerirLiderDelGrupo(idUsuario, idGrupo, tx);
    if (datos.estado === "finalizado") {
      const tareasAbiertas = await tx.tarea.count({
        where: { idGrupo, estado: { in: [...ESTADOS_TAREA_ABIERTOS] } },
      });
      if (tareasAbiertas > 0) {
        throw new ErrorDeNegocio(
          `Completa o descarta ${tareasAbiertas === 1 ? "la tarea abierta" : `las ${tareasAbiertas} tareas abiertas`} antes de finalizar el grupo`,
        );
      }
    }
    if (datos.estado === "finalizado") {
      // Un grupo finalizado es de solo lectura: las invitaciones sin responder ya no se pueden aceptar.
      await tx.grupoIntegrante.updateMany({
        where: { idGrupo, estadoInvitacion: "pendiente" },
        data: { estadoInvitacion: "cancelada" },
      });
    }
    let fechaLimite: Date | undefined;
    if (datos.fechaLimite) {
      const nueva = finDeDiaLimaAUtc(datos.fechaLimite);
      // Si el día no cambia no se vuelve a validar: se pueden guardar otros campos con una fecha ya vencida.
      if (!grupo.fechaLimite || fechaEnZonaLimaISO(grupo.fechaLimite) !== datos.fechaLimite) {
        if (nueva < new Date()) throw new ErrorDeNegocio("La fecha límite del grupo no puede estar en el pasado");
        const posteriores = await tx.tarea.count({
          where: { idGrupo, estado: { in: [...ESTADOS_TAREA_ABIERTOS] }, fechaLimite: { gt: nueva } },
        });
        if (posteriores > 0) {
          throw new ErrorDeNegocio(`Hay ${posteriores} ${posteriores === 1 ? "tarea" : "tareas"} con fecha posterior`);
        }
        fechaLimite = nueva;
      }
    }
    return tx.grupo.update({
      where: { idGrupo },
      data: {
        ...(fechaLimite ? { fechaLimite } : {}),
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        enlaceTrabajo: datos.enlaceTrabajo || null,
        estado: datos.estado,
      },
    });
  });
}

/** Minúsculas y sin tildes, igual que el translate() de la consulta SQL (sin extensión unaccent). */
export function normalizarTextoBusqueda(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Escapa los comodines de LIKE para que un % o _ escrito por la persona se busque como texto. */
function escaparLike(texto: string) {
  return texto.replace(/[\\%_]/g, "\\$&");
}

function sqlNormalizado(columna: Prisma.Sql) {
  return Prisma.sql`translate(lower(coalesce(${columna}, '')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')`;
}

type ResultadoBusqueda = {
  idUsuario: number;
  nombre: string;
  apellidos: string | null;
  correo: string;
  fotoUrl: string | null;
};

/**
 * Cada palabra (máximo 4) debe aparecer en nombre o apellidos, sin importar tildes ni mayúsculas.
 * Los compañeros de grupo (ambos aceptados) van primero y el límite se aplica después de ordenar.
 * No se muestran datos de disponibilidad.
 */
export async function buscarUsuarios(idUsuarioActual: number, consulta: string): Promise<ResultadoBusqueda[]> {
  const texto = consulta.trim();
  if (!texto) return [];

  const esCorreo = texto.includes("@");
  if (!esCorreo && texto.length < MIN_CARACTERES_BUSQUEDA) return [];

  let condicion: Prisma.Sql;
  if (esCorreo) {
    condicion = Prisma.sql`u.correo = ${texto.toLowerCase()}`;
  } else {
    const palabras = normalizarTextoBusqueda(texto).split(/\s+/).filter(Boolean).slice(0, MAX_PALABRAS_BUSQUEDA);
    if (palabras.length === 0) return [];
    condicion = Prisma.join(
      palabras.map((palabra) => {
        const patron = `%${escaparLike(palabra)}%`;
        return Prisma.sql`(${sqlNormalizado(Prisma.sql`u.nombre`)} LIKE ${patron} OR ${sqlNormalizado(Prisma.sql`u.apellidos`)} LIKE ${patron})`;
      }),
      " AND ",
    );
  }

  return prisma.$queryRaw<ResultadoBusqueda[]>`
    SELECT u.id_usuario AS "idUsuario", u.nombre, u.apellidos, u.correo, u.foto_url AS "fotoUrl"
    FROM usuario u
    JOIN perfil p ON p.id_usuario = u.id_usuario
    WHERE u.id_usuario <> ${idUsuarioActual}
      AND u.eliminado_en IS NULL
      AND p.visible_en_busqueda = true
      AND (${condicion})
    ORDER BY EXISTS (
        SELECT 1
        FROM grupo_integrante otro
        JOIN grupo_integrante yo ON yo.id_grupo = otro.id_grupo
        WHERE otro.id_usuario = u.id_usuario AND otro.estado_invitacion = 'aceptada'
          AND yo.id_usuario = ${idUsuarioActual} AND yo.estado_invitacion = 'aceptada'
      ) DESC,
      lower(u.nombre), lower(coalesce(u.apellidos, '')), u.id_usuario
    LIMIT ${LIMITE_RESULTADOS_BUSQUEDA}
  `;
}

/** Buscador general de personas: mismas reglas que buscarUsuarios, pero sin correo (perfil publico). */
export async function buscarPersonas(idUsuarioActual: number, consulta: string) {
  const encontrados = await buscarUsuarios(idUsuarioActual, consulta);
  if (encontrados.length === 0) return [];
  const ids = encontrados.map((u) => u.idUsuario);

  const [perfiles, compartidos] = await Promise.all([
    prisma.perfil.findMany({
      where: { idUsuario: { in: ids } },
      select: { idUsuario: true, carrera: true, institucion: true, ciclo: true },
    }),
    // Grupos donde ambos estan aceptados: definen a los companeros (se muestran primero).
    prisma.grupoIntegrante.findMany({
      where: {
        idUsuario: { in: ids },
        estadoInvitacion: "aceptada",
        grupo: { integrantes: { some: { idUsuario: idUsuarioActual, estadoInvitacion: "aceptada" } } },
      },
      select: { idUsuario: true },
    }),
  ]);
  const porUsuario = new Map(perfiles.map((p) => [p.idUsuario, p]));
  const gruposEnComun = new Map<number, number>();
  for (const { idUsuario } of compartidos) gruposEnComun.set(idUsuario, (gruposEnComun.get(idUsuario) ?? 0) + 1);

  return encontrados
    .map(({ idUsuario, nombre, apellidos, fotoUrl }) => ({
      idUsuario,
      nombre,
      apellidos,
      fotoUrl,
      carrera: porUsuario.get(idUsuario)?.carrera ?? null,
      institucion: porUsuario.get(idUsuario)?.institucion ?? null,
      ciclo: porUsuario.get(idUsuario)?.ciclo ?? null,
      gruposEnComun: gruposEnComun.get(idUsuario) ?? 0,
    }));
}

export async function invitarIntegrante(
  idActor: number,
  idGrupo: number,
  idUsuarioInvitado: number,
  rol: "miembro" | "observador" = "miembro",
) {
  const { grupo, integrante } = await ejecutarCambioDeGrupo(async (tx) => {
    const grupo = await requerirLiderDelGrupo(idActor, idGrupo, tx);

    // Solo cuentan las invitaciones que envió esta persona; la fila de quien creó el grupo no es una invitación.
    const invitacionesUltimaHora = await tx.grupoIntegrante.count({
      where: {
        idInvitador: idActor,
        idUsuario: { not: idActor },
        fechaInvitacion: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (invitacionesUltimaHora >= LIMITE_INVITACIONES_POR_HORA) {
      throw new ErrorDeNegocio("Llegaste al límite de invitaciones por hora, intenta más tarde");
    }

    const invitado = await tx.usuario.findUnique({
      where: { idUsuario: idUsuarioInvitado },
      select: { eliminadoEn: true, perfil: { select: { visibleEnBusqueda: true } } },
    });
    const previa = await tx.grupoIntegrante.findUnique({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario: idUsuarioInvitado } },
    });
    // Mismo mensaje para inexistente, eliminado u oculto: no se revela quién existe.
    if (!invitado || invitado.eliminadoEn || (!previa && !invitado.perfil?.visibleEnBusqueda)) {
      throw new ErrorDeNegocio("Usuario no encontrado");
    }
    // Quien rechazó o cuya invitación se canceló puede ser invitado otra vez (reabre su misma fila);
    // quien ya está, tiene una pendiente, salió o fue retirado, no.
    if (previa && previa.estadoInvitacion !== "rechazada" && previa.estadoInvitacion !== "cancelada") {
      throw new ErrorDeNegocio("Esa persona ya fue invitada a este grupo antes");
    }

    const integrante = previa
      ? await tx.grupoIntegrante.update({
          where: { idGrupo_idUsuario: { idGrupo, idUsuario: idUsuarioInvitado } },
          data: { estadoInvitacion: "pendiente", rol, fechaInvitacion: new Date(), fechaRespuesta: null, idInvitador: idActor },
        })
      : await tx.grupoIntegrante.create({
          data: { idGrupo, idUsuario: idUsuarioInvitado, rol, estadoInvitacion: "pendiente", idInvitador: idActor },
        });
    return { grupo, integrante };
  });

  const invitador = await prisma.usuario.findUnique({ where: { idUsuario: idActor }, select: { nombre: true, apellidos: true } });
  await crearNotificacion({
    idUsuario: idUsuarioInvitado,
    tipo: "invitacion_grupo",
    ...plantillasNotificacion.invitacionGrupo(grupo.nombre, idGrupo, invitador ? nombreCorto(invitador.nombre, invitador.apellidos) : null),
  });

  return integrante;
}

export async function responderInvitacion(
  idUsuario: number,
  idGrupo: number,
  respuesta: "aceptada" | "rechazada",
) {
  const integrante = await ejecutarCambioDeGrupo(async (tx) => {
    const integrante = await tx.grupoIntegrante.findUnique({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
      include: { grupo: true },
    });
    if (!integrante || integrante.estadoInvitacion !== "pendiente") {
      throw new ErrorDeNegocio("No tienes una invitación pendiente a ese grupo");
    }
    if (integrante.grupo.estado !== "activo") {
      throw new ErrorDeNegocio("El grupo está finalizado y es de solo lectura");
    }

    await tx.grupoIntegrante.update({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
      data: { estadoInvitacion: respuesta, fechaRespuesta: new Date() },
    });
    return integrante;
  });

  // Avisa a quien envió la invitación (los registros antiguos asumen al creador del grupo).
  const idInvitador = integrante.idInvitador ?? integrante.grupo.idCreador;
  if (idInvitador === idUsuario) return;
  // Si quien invitó ya salió del grupo (o fue retirado), el aviso no le sirve.
  const invitadorActivo = await prisma.grupoIntegrante.findFirst({
    where: { idGrupo, idUsuario: idInvitador, estadoInvitacion: "aceptada" },
    select: { idUsuario: true },
  });
  if (!invitadorActivo) return;
  const persona = await prisma.usuario.findUnique({ where: { idUsuario }, select: { nombre: true, apellidos: true } });
  await crearNotificacion({
    idUsuario: idInvitador,
    tipo: "invitacion_respondida",
    ...plantillasNotificacion.invitacionRespondida(integrante.grupo.nombre, idGrupo, respuesta, persona ? nombreCorto(persona.nombre, persona.apellidos) : null),
  });
}

/**
 * Preferencia personal por grupo: la campana siempre permanece activa y solo se silencian los
 * correos de actividad. Los correos importantes no dependen de este valor (AGENTS.md 8.6).
 */
export async function actualizarPreferenciaCorreoActividad(
  idUsuario: number,
  idGrupo: number,
  correoActividad: boolean,
) {
  return ejecutarCambioDeGrupo(async (tx) => {
    const integrante = await tx.grupoIntegrante.findUnique({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
      include: { grupo: { select: { estado: true } } },
    });

    if (!integrante || integrante.estadoInvitacion !== "aceptada") {
      throw new ErrorDeNegocio("No eres integrante de este grupo");
    }
    if (integrante.rol === "observador") {
      throw new ErrorDeNegocio("Los observadores no reciben avisos de actividad");
    }
    if (integrante.grupo.estado !== "activo") {
      throw new ErrorDeNegocio("El grupo está finalizado y es de solo lectura");
    }

    await tx.grupoIntegrante.update({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
      data: { correoActividad },
    });
  });
}

/**
 * Deja las tareas abiertas de quien deja el grupo sin responsable y lo registra en el historial
 * (AGENTS.md 8.3). `pendiente` queda pendiente; `en_progreso` vuelve a `pendiente` (igual que al
 * reasignarla); `en_revision` conserva a quien la entregó para que el líder la apruebe o devuelva:
 * es su aporte y no hay estado imposible, porque aprobar, devolver o reabrir ya resuelven un
 * responsable que no puede recibir tareas (ver `cambiarEstadoTarea`).
 */
async function desasignarTareasAbiertas(tx: Prisma.TransactionClient, idGrupo: number, idUsuarioObjetivo: number, idActor: number) {
  const tareas = await tx.tarea.findMany({
    where: { idGrupo, idAsignado: idUsuarioObjetivo, estado: { in: ["pendiente", "en_progreso"] } },
    select: { idTarea: true, idAsignado: true, estado: true },
  });
  if (tareas.length === 0) return;
  await tx.tarea.updateMany({
    where: { idTarea: { in: tareas.map((tarea) => tarea.idTarea) } },
    data: { idAsignado: null, estado: "pendiente", fechaTerminada: null },
  });
  const historial: Prisma.TareaHistorialCreateManyInput[] = [];
  for (const tarea of tareas) {
    historial.push({ idTarea: tarea.idTarea, idUsuario: idActor, accion: "reasignada", valorAnterior: String(tarea.idAsignado), valorNuevo: null });
    if (tarea.estado === "en_progreso") {
      historial.push({ idTarea: tarea.idTarea, idUsuario: idActor, accion: "estado", valorAnterior: "en_progreso", valorNuevo: "pendiente" });
    }
  }
  await tx.tareaHistorial.createMany({ data: historial });
}

/**
 * El líder cambia a un integrante aceptado entre miembro y observador. Al pasar a observador se le
 * desasignan sus tareas abiertas (un observador no recibe tareas). El líder no cambia de rol aquí.
 */
export async function cambiarRolIntegrante(idActor: number, idGrupo: number, idUsuarioObjetivo: number, rol: "miembro" | "observador") {
  await ejecutarCambioDeGrupo(async (tx) => {
    await requerirLiderDelGrupo(idActor, idGrupo, tx);
    const objetivo = await tx.grupoIntegrante.findUnique({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario: idUsuarioObjetivo } },
    });
    if (!objetivo || objetivo.estadoInvitacion !== "aceptada") throw new ErrorDeNegocio("Esa persona no es integrante del grupo");
    if (objetivo.rol === "lider") throw new ErrorDeNegocio("El rol del líder no se puede cambiar");
    if (objetivo.rol === rol) return;
    await tx.grupoIntegrante.update({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario: idUsuarioObjetivo } },
      data: { rol },
    });
    if (rol === "observador") await desasignarTareasAbiertas(tx, idGrupo, idUsuarioObjetivo, idActor);
  });
}

/**
 * Retira la invitación de alguien que aún no respondió (por ejemplo, se invitó a la persona equivocada).
 * Nunca fue integrante: no queda como retirado y se la puede volver a invitar.
 */
export async function cancelarInvitacion(idActor: number, idGrupo: number, idUsuarioObjetivo: number) {
  await ejecutarCambioDeGrupo(async (tx) => {
    await requerirLiderDelGrupo(idActor, idGrupo, tx);
    await cancelarInvitacionPendiente(tx, idGrupo, idUsuarioObjetivo);
  });
}

async function cancelarInvitacionPendiente(tx: Prisma.TransactionClient, idGrupo: number, idUsuario: number) {
  const objetivo = await tx.grupoIntegrante.findUnique({ where: { idGrupo_idUsuario: { idGrupo, idUsuario } } });
  if (!objetivo || objetivo.estadoInvitacion !== "pendiente") {
    throw new ErrorDeNegocio("Esa persona ya no tiene una invitación pendiente");
  }
  await tx.grupoIntegrante.update({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    data: { estadoInvitacion: "cancelada" },
  });
}

export async function retirarIntegrante(idActor: number, idGrupo: number, idUsuarioObjetivo: number) {
  await ejecutarCambioDeGrupo(async (tx) => {
    await requerirLiderDelGrupo(idActor, idGrupo, tx);

    const objetivo = await tx.grupoIntegrante.findUnique({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario: idUsuarioObjetivo } },
    });
    // Una invitación pendiente se cancela, no se "retira": así no queda como ex integrante.
    if (objetivo?.estadoInvitacion === "pendiente") {
      await cancelarInvitacionPendiente(tx, idGrupo, idUsuarioObjetivo);
      return;
    }
    if (!objetivo || objetivo.estadoInvitacion !== "aceptada") {
      throw new ErrorDeNegocio("Esa persona no es integrante del grupo");
    }
    if (objetivo.rol === "lider") throw new ErrorDeNegocio("El lider no se puede retirar a si mismo");

    await tx.grupoIntegrante.update({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario: idUsuarioObjetivo } },
      data: { estadoInvitacion: "retirado", fechaRetiro: new Date(), retiroVoluntario: false },
    });
    await desasignarTareasAbiertas(tx, idGrupo, idUsuarioObjetivo, idActor);
  });
}

/**
 * Salida voluntaria dentro de una transacción de grupo (la usan `salirDelGrupo` y `eliminarCuenta`).
 * Con `sinLider` (cuenta eliminada de quien lidera un grupo sin otro integrante que pueda liderar)
 * no se exige nuevo líder: el grupo queda como está.
 */
export async function salirDelGrupoEnTransaccion(
  tx: Prisma.TransactionClient,
  idUsuario: number,
  idGrupo: number,
  opciones: { idNuevoLider?: number; sinLider?: boolean } = {},
) {
  const { idNuevoLider, sinLider = false } = opciones;
  const propio = await tx.grupoIntegrante.findUnique({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    include: { grupo: true },
  });
  if (!propio || propio.estadoInvitacion !== "aceptada") throw new ErrorDeNegocio("No eres integrante de este grupo");
  if (propio.grupo.estado !== "activo") throw new ErrorDeNegocio("El grupo está finalizado y es de solo lectura");

  let idLider: number | null = null;
  if (propio.rol === "lider" && !sinLider) {
    if (!idNuevoLider || idNuevoLider === idUsuario) throw new ErrorDeNegocio("Elige quién será el nuevo líder antes de salir");
    const nuevo = await tx.grupoIntegrante.findUnique({
      where: { idGrupo_idUsuario: { idGrupo, idUsuario: idNuevoLider } },
    });
    if (!nuevo || nuevo.estadoInvitacion !== "aceptada" || nuevo.rol !== "miembro") {
      throw new ErrorDeNegocio("El nuevo líder debe ser un miembro aceptado del grupo");
    }
    await tx.grupoIntegrante.update({ where: { idGrupo_idUsuario: { idGrupo, idUsuario: idNuevoLider } }, data: { rol: "lider" } });
    idLider = idNuevoLider;
  } else if (propio.rol !== "lider") {
    const lider = await tx.grupoIntegrante.findFirst({ where: { idGrupo, rol: "lider", estadoInvitacion: "aceptada" } });
    idLider = lider?.idUsuario ?? null;
  }

  await tx.grupoIntegrante.update({
    where: { idGrupo_idUsuario: { idGrupo, idUsuario } },
    data: {
      estadoInvitacion: "retirado",
      fechaRetiro: new Date(),
      retiroVoluntario: true,
      ...(propio.rol === "lider" && !sinLider ? { rol: "miembro" as const } : {}),
    },
  });
  await desasignarTareasAbiertas(tx, idGrupo, idUsuario, idUsuario);
  return { grupo: propio.grupo, idLider, nuevoLider: Boolean(idNuevoLider && idNuevoLider === idLider) };
}

/** Avisa al líder (o al nuevo líder) que alguien salió; solo dentro de la app. */
export async function notificarSalidaDelGrupo(
  persona: { nombre: string; apellidos: string | null },
  idUsuario: number,
  salida: { grupo: { idGrupo: number; nombre: string }; idLider: number | null; nuevoLider: boolean },
) {
  if (!salida.idLider || salida.idLider === idUsuario) return;
  await crearNotificacion({
    idUsuario: salida.idLider,
    tipo: "integrante_salio",
    idGrupo: salida.grupo.idGrupo,
    ...plantillasNotificacion.integranteSalio(nombreCorto(persona.nombre, persona.apellidos), salida.grupo.nombre, salida.grupo.idGrupo, salida.nuevoLider),
  });
}

/**
 * Salir del grupo por cuenta propia (decisión del usuario, 2026-11-16). Queda igual que un retiro
 * (estado `retirado`, fila conservada, tareas abiertas desasignadas) pero marcado como voluntario.
 * El líder primero cede el liderazgo a un miembro aceptado; si no hay ninguno, no puede salir.
 */
export async function salirDelGrupo(idUsuario: number, idGrupo: number, idNuevoLider?: number) {
  const salida = await ejecutarCambioDeGrupo((tx) => salirDelGrupoEnTransaccion(tx, idUsuario, idGrupo, { idNuevoLider }));
  const usuario = await prisma.usuario.findUnique({ where: { idUsuario }, select: { nombre: true, apellidos: true } });
  await notificarSalidaDelGrupo(usuario ?? { nombre: "Alguien", apellidos: null }, idUsuario, salida);
}
