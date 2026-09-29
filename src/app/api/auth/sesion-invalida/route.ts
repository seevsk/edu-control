import { NextResponse } from "next/server";
import { cerrarSesion } from "@/server/auth/session";
import { env } from "@/lib/env";

/**
 * Las cookies solo se pueden modificar en un Server Action o un Route Handler, nunca durante
 * el render de una pagina -- por eso este paso intermedio en vez de borrar la cookie directo
 * desde requerirUsuarioValido().
 */
export async function GET() {
  await cerrarSesion();
  const mensaje = "Tu sesion ya no es valida, entra de nuevo";
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(mensaje)}`, env.APP_URL));
}
