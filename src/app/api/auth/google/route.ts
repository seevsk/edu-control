import { NextResponse } from "next/server";
import { crearAutorizacionGoogle } from "@/server/auth/google";
import { guardarCodeVerifier } from "@/server/auth/pkce-cookie";
import { env } from "@/lib/env";

export async function GET() {
  const redirectUri = new URL("/api/auth/google/callback", env.APP_URL).toString();
  const { url, codeVerifier } = await crearAutorizacionGoogle(redirectUri);

  await guardarCodeVerifier(codeVerifier);

  return NextResponse.redirect(url);
}
