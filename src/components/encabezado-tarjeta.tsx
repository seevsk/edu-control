/** Titulo central de una tarjeta: que es (etiqueta) encima del valor, junto al icono si lo hay. */
export function EncabezadoTarjeta({
  etiqueta,
  titulo,
  icono,
}: {
  etiqueta: string;
  titulo: string;
  icono?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      {icono}
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{etiqueta}:</p>
        <p className="mt-0.5 font-medium leading-snug">{titulo}</p>
      </div>
    </div>
  );
}
