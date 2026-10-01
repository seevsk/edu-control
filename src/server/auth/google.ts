import * as client from "openid-client";
import { env } from "@/lib/env";

const GOOGLE_ISSUER = new URL("https://accounts.google.com");
const SCOPES = "openid email profile";

let configuracion: Promise<client.Configuration> | null = null;

function obtenerConfiguracion() {
  configuracion ??= client.discovery(GOOGLE_ISSUER, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  return configuracion;
}

export async function crearAutorizacionGoogle(redirectUri: string) {
  const config = await obtenerConfiguracion();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return { url, codeVerifier };
}

export interface ClaimsGoogle {
  sub: string;
  email: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/** Intercambia el code por tokens y valida el ID token. No se persiste ningun token de Google. */
export async function validarCallbackGoogle(
  callbackUrl: URL,
  codeVerifier: string,
): Promise<ClaimsGoogle> {
  const config = await obtenerConfiguracion();
  const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: codeVerifier,
    idTokenExpected: true,
  });

  const claims = tokens.claims();
  if (!claims || typeof claims.sub !== "string" || typeof claims.email !== "string") {
    throw new Error("El ID token de Google no trae los claims esperados");
  }

  return {
    sub: claims.sub,
    email: claims.email,
    given_name: typeof claims.given_name === "string" ? claims.given_name : undefined,
    family_name: typeof claims.family_name === "string" ? claims.family_name : undefined,
    picture: typeof claims.picture === "string" ? claims.picture : undefined,
  };
}
