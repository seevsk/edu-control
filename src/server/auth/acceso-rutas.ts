import { prisma } from "@/server/db/client";
import { obtenerPerfilPublico } from "@/server/services/perfil";
import { obtenerHorarioCompanero } from "@/server/services/disponibilidad";

const MAX_ID = 2_147_483_647;

/** Rutas privadas cuyo acceso depende del recurso: grupo, curso o perfil de otra persona. */
const RUTAS = [
  { patron: /^\/grupos\/([^/]+)(?:\/.*)?$/, tipo: "grupo" },
  { patron: /^\/cursos\/([^/]+)\/?$/, tipo: "curso" },
  { patron: /^\/usuarios\/([^/]+)\/disponibilidad\/?$/, tipo: "disponibilidad" },
  { patron: /^\/usuarios\/([^/]+)\/?$/, tipo: "perfil" },
] as const;

function idValido(texto: string) {
  if (!/^[1-9]\d*$/.test(texto)) return null;
  const id = Number(texto);
  return id <= MAX_ID ? id : null;
}

/**
 * ¿Puede este usuario abrir esta ruta? Se evalúa en `proxy`, antes de que la página empiece a
 * transmitirse, para responder un 404 real (no confirmar que el recurso existe, AGENTS.md 8.3).
 * `null` = la ruta no está protegida por recurso (la página decide). Las páginas y los servicios
 * siguen verificando el acceso: esto solo adelanta la respuesta, no reemplaza esas verificaciones.
 */
export async function puedeAbrirRuta(idUsuario: number, ruta: string): Promise<boolean | null> {
  for (const { patron, tipo } of RUTAS) {
    const coincidencia = ruta.match(patron);
    if (!coincidencia) continue;
    const id = idValido(coincidencia[1]);
    if (id === null) return false;

    switch (tipo) {
      case "grupo":
        return (await prisma.grupoIntegrante.count({ where: { idGrupo: id, idUsuario, estadoInvitacion: "aceptada" } })) > 0;
      case "curso":
        return (await prisma.curso.count({ where: { idCurso: id, idUsuario } })) > 0;
      case "perfil":
        // El propio perfil redirige a /perfil desde la página.
        return id === idUsuario || (await obtenerPerfilPublico(idUsuario, id)) !== null;
      case "disponibilidad":
        return id !== idUsuario && (await obtenerHorarioCompanero(idUsuario, id)) !== null;
    }
  }
  return null;
}
