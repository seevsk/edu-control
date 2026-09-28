import { IconGoogle } from "@/components/icons";

const vistaPrevia = [
  { estado: "Completada", color: "var(--color-estado-completada)", persona: "Ana", tarea: "Levantar Postgres local" },
  { estado: "En revision", color: "var(--color-estado-revision)", persona: "Ana", tarea: "Mockup del tablero" },
  { estado: "En progreso", color: "var(--color-estado-progreso)", persona: "Bruno", tarea: "Esquema de base de datos" },
] as const;

const mensajesError: Record<string, string> = {
  google: "No pudimos completar el login con Google. Intenta de nuevo.",
  sesion_expirada: "El login tardo demasiado y expiro. Intenta de nuevo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const mensajeError = error ? mensajesError[error] : undefined;

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <section className="hidden flex-col justify-center gap-8 bg-text px-12 text-white md:flex">
        <div>
          <p className="text-lg font-semibold">EduControl</p>
          <h1 className="mt-3 max-w-sm text-2xl font-semibold text-balance">
            El avance del grupo, con datos, no con la palabra de cada uno.
          </h1>
        </div>

        <div className="max-w-sm rounded-md border border-white/15 bg-white/5 p-4">
          <p className="text-xs text-white/60">Avance del grupo</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {vistaPrevia.map((fila) => (
              <li key={fila.tarea} className="flex items-center gap-2.5 text-sm">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: fila.color }}
                  aria-hidden
                />
                <span className="text-white/90">{fila.tarea}</span>
                <span className="ml-auto text-xs text-white/50">{fila.persona}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col justify-center gap-6 px-6 py-12 sm:px-10 md:px-16">
        <div className="mx-auto w-full max-w-sm">
          <p className="text-lg font-semibold md:hidden">EduControl</p>
          <h2 className="mt-4 text-xl font-semibold md:mt-0">Entra con tu cuenta de Google</h2>
          <p className="mt-2 text-sm text-text-muted">
            La primera vez que entras creamos tu cuenta automaticamente. No pedimos acceso a tu
            Gmail ni a tu calendario.
          </p>

          {mensajeError ? (
            <p className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {mensajeError}
            </p>
          ) : null}

          <a
            href="/api/auth/google"
            className="mt-6 flex items-center justify-center gap-3 rounded-md border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-text shadow-sm hover:bg-bg"
          >
            <IconGoogle className="size-5" aria-hidden />
            Continuar con Google
          </a>
        </div>
      </section>
    </div>
  );
}
