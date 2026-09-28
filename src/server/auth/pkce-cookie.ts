import { cookies } from "next/headers";

const COOKIE_VERIFIER = "educontrol_google_verifier";
const DURACION_SEGUNDOS = 60 * 10; // 10 minutos: alcanza para completar el login en Google

export async function guardarCodeVerifier(codeVerifier: string) {
  const store = await cookies();
  store.set(COOKIE_VERIFIER, codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: DURACION_SEGUNDOS,
  });
}

export async function leerYBorrarCodeVerifier(): Promise<string | null> {
  const store = await cookies();
  const verifier = store.get(COOKIE_VERIFIER)?.value ?? null;
  store.delete(COOKIE_VERIFIER);
  return verifier;
}
