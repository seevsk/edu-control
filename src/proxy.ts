import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import { puedeAbrirRuta } from "@/server/auth/acceso-rutas";

const secreto = () => new TextEncoder().encode(process.env.SESSION_SECRET);

async function idDeSesion(request: NextRequest): Promise<number | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secreto());
    return typeof payload.idUsuario === "number" ? payload.idUsuario : null;
  } catch {
    return null;
  }
}

/**
 * - /login: con sesión válida, va directo al inicio.
 * - Grupos, cursos y perfiles ajenos: si no hay acceso, 404 real antes de transmitir la página
 *   (la página se envía por partes y después ya no se puede cambiar el código). Solo en cargas
 *   de página: las Server Actions (POST) validan permisos en el servidor y responden su error.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const idUsuario = await idDeSesion(request);

  if (pathname === "/login") {
    return idUsuario ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  // Sin sesión, la página redirige a /login.
  if (!idUsuario || (request.method !== "GET" && request.method !== "HEAD")) return NextResponse.next();

  const permitido = await puedeAbrirRuta(idUsuario, pathname);
  if (permitido === false) {
    // Ruta inexistente a propósito: Next muestra src/app/not-found.tsx con estado 404.
    return NextResponse.rewrite(new URL("/_no-disponible", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/grupos/:id/:path*", "/cursos/:id", "/reuniones/:id", "/reuniones/:id/sala", "/usuarios/:id/:path*"],
};
