import { prisma } from "@/server/db/client";
import type { ClaimsGoogle } from "@/server/auth/google";

/**
 * Upsert por googleId (nunca por correo: el correo de una cuenta de Workspace puede cambiar).
 * correo/dominioCorreo se refrescan en cada login; nombre, apellidos y foto solo se fijan al crear
 * la cuenta (despues el usuario los podra editar desde su perfil).
 */
export async function iniciarSesionConGoogle(claims: ClaimsGoogle) {
  const correo = claims.email.toLowerCase();
  const dominioCorreo = correo.split("@")[1] ?? null;

  const usuario = await prisma.usuario.upsert({
    where: { googleId: claims.sub },
    update: {
      correo,
      dominioCorreo,
    },
    create: {
      googleId: claims.sub,
      correo,
      dominioCorreo,
      nombre: claims.given_name ?? correo,
      apellidos: claims.family_name,
      fotoUrl: claims.picture,
      perfil: {
        create: {
          tipoCuenta: "estudiante",
        },
      },
    },
  });

  return usuario;
}

export async function obtenerUsuarioActual(idUsuario: number) {
  return prisma.usuario.findUniqueOrThrow({ where: { idUsuario } });
}
