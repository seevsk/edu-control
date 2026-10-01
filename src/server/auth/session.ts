import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { SESSION_COOKIE_NAME } from "./constants";

const DURACION_SEGUNDOS = 60 * 60 * 24 * 30; // 30 dias
const secreto = new TextEncoder().encode(env.SESSION_SECRET);

export interface SesionUsuario {
  idUsuario: number;
}

export async function crearSesion(idUsuario: number) {
  const token = await new SignJWT({ idUsuario })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEGUNDOS}s`)
    .sign(secreto);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SEGUNDOS,
  });
}

/** Nunca confies en un id de usuario que venga del cliente: siempre sale de esta cookie firmada por el servidor. */
export async function obtenerSesion(): Promise<SesionUsuario | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secreto);
    if (typeof payload.idUsuario !== "number") return null;
    return { idUsuario: payload.idUsuario };
  } catch {
    return null;
  }
}

export async function requerirSesion(): Promise<SesionUsuario> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  return sesion;
}

export async function cerrarSesion() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
