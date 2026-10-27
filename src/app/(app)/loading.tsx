export default function CargandoApp() {
  return (
    <div className="animate-pulse mx-auto flex max-w-5xl flex-col gap-6" aria-label="Cargando contenido">
      <div className="h-7 w-56 rounded-md bg-border" />
      <div className="h-4 w-80 rounded-md bg-border/70" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-36 rounded-md border border-border bg-surface" />
        ))}
      </div>
      <div className="h-72 rounded-md border border-border bg-surface" />
    </div>
  );
}
