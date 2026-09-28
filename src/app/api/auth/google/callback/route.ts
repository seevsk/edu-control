import { NextRequest, NextResponse } from "next/server";
import { validarCallbackGoogle } from "@/server/auth/google";
import { leerYBorrarCodeVerifier } from "@/server/auth/pkce-cookie";
import { crearSesion } from "@/server/auth/session";
import { iniciarSesionConGoogle } from "@/server/services/usuario";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const codeVerifier = await leerYBorrarCodeVerifier();

  if (!codeVerifier) {
    return NextResponse.redirect(new URL("/login?error=sesion_expirada", env.APP_URL));
  }

  try {
    const claims = await validarCallbackGoogle(new URL(request.url), codeVerifier);
    const usuario = await iniciarSesionConGoogle(claims);
    await crearSesion(usuario.idUsuario);
  } catch (error) {
    console.error("Fallo el login con Google", error);
    return NextResponse.redirect(new URL("/login?error=google", env.APP_URL));
  }

  return NextResponse.redirect(new URL("/", env.APP_URL));
}
