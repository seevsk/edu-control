/** Peso 1-3 como puntos: el mismo signo en tablero, lista y detalle. */
export function PesoTarea({ peso }: { peso: number }) {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`Peso ${peso} de 3`}>
      {[1, 2, 3].map((nivel) => (
        <span
          key={nivel}
          className={`size-1.5 rounded-full ${nivel <= peso ? "bg-text-muted" : "bg-border-strong"}`}
          aria-hidden
        />
      ))}
    </span>
  );
}
