import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { LoginC } from "./_components/login-c";

// El botón de Google usa Roboto Medium, como pide su guía de marca.
const roboto = Roboto({ subsets: ["latin"], weight: "500", display: "swap" });

/** Única página pública: es la que se indexa y se comparte. */
export const metadata: Metadata = {
  title: "Iniciar sesión",
  description:
    "Entra con tu cuenta de Google y organiza tus trabajos grupales: reparte tareas, mira quién avanzó y encuentra cuándo reunirse.",
  alternates: { canonical: "/login" },
  robots: { index: true, follow: false, googleBot: { index: true, follow: false } },
};

const mensajesError: Record<string, string> = {
  google: "No pudimos completar el inicio de sesión con Google. Intenta de nuevo.",
  sesion_expirada: "El inicio de sesión tardó demasiado y expiró. Intenta de nuevo.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginC error={error ? mensajesError[error] : undefined} fuenteGoogle={roboto.className} />;
}
