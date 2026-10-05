/** Filas "Etiqueta: valor" de una tarjeta. Las filas sin valor no se muestran. */
export function DatosTarjeta({ datos }: { datos: { etiqueta: string; valor: React.ReactNode; titulo?: string }[] }) {
  const visibles = datos.filter((dato) => dato.valor !== null && dato.valor !== undefined && dato.valor !== "");
  if (visibles.length === 0) return null;

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
      {visibles.map((dato) => (
        <div key={dato.etiqueta} className="contents">
          <dt className="text-text-muted">{dato.etiqueta}:</dt>
          <dd className="truncate text-text" title={dato.titulo ?? (typeof dato.valor === "string" ? dato.valor : undefined)}>
            {dato.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}
