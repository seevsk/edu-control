import type { Metadata } from "next";
import Link from "next/link";
import { Logotipo } from "@/components/marca/monograma";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No disponible" };

/**
 * 404 de toda la app. Mismo texto para "no existe" y "no es tuyo": no se confirma que un grupo,
 * curso o perfil exista a quien no tiene acceso (AGENTS.md 8.3).
 */
export default function NoEncontrado() {
  return (
    <div className="flex min-h-dvh flex-col bg-muted text-foreground dark:bg-background">
      <header className="px-5 py-5 sm:px-14 sm:py-6">
        <Link href="/" aria-label="EduControl, ir al inicio"><Logotipo /></Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-24">
        <div className="flex max-w-md flex-col items-start gap-3">
          <p className="text-[13px] text-subtle-foreground tabular-nums">Error 404</p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-balance">Este contenido no existe o no está disponible para ti</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Si te compartieron este enlace, pide que te inviten al grupo desde EduControl.
          </p>
          <Button className="mt-2" asChild><Link href="/">Volver al inicio</Link></Button>
        </div>
      </main>
    </div>
  );
}
