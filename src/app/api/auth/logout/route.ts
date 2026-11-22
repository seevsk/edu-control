import { NextResponse } from "next/server";
import { cerrarSesion } from "@/server/auth/session";
import { env } from "@/lib/env";

/** El cierre de sesión solo vale si lo pide la propia app (evita cierres forzados desde otro sitio). */
function vieneDeLaApp(request: Request) {
  const sitio = request.headers.get("sec-fetch-site");
  if (sitio && sitio !== "same-origin" && sitio !== "none") return false;
  const origen = request.headers.get("origin");
  if (!origen) return true;
  try {
    return new URL(origen).host === new URL(env.APP_URL).host;
  } catch {
    return false; // origen opaco ("null")
  }
}

export async function POST(request: Request) {
  if (!vieneDeLaApp(request)) {
    return NextResponse.redirect(new URL("/", env.APP_URL), 303);
  }
  await cerrarSesion();
  // 303: el navegador sigue con GET a /login en vez de repetir el POST.
  return NextResponse.redirect(new URL("/login", env.APP_URL), 303);
}
