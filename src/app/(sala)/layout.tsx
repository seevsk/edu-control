import { requerirSesion } from "@/server/auth/session";

/** Pantalla completa para la videollamada: sin barra lateral, superior ni inferior de la app, en ningún tamaño. */
export default async function SalaLayout({ children }: LayoutProps<"/">) {
  await requerirSesion();
  return <div className="flex h-dvh flex-col bg-background text-foreground">{children}</div>;
}
