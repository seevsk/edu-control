import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-md border border-border bg-surface p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Página no encontrada</p>
      <h1 className="text-lg font-semibold">Este contenido no existe o no está disponible para ti</h1>
      <p className="text-sm text-text-muted">
        Revisa el enlace o vuelve al inicio para continuar trabajando.
      </p>
      <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
        Volver al inicio
      </Link>
    </div>
  );
}
