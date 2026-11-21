import { cn } from "@/lib/utils";

/**
 * Encabezado de sección de las listas de reuniones. Escritorio y tablet: barra gris de 36 px.
 * Móvil: texto de 13 px sobre el fondo. `ancho` ajusta el margen lateral al de cada pantalla.
 */
export function EncabezadoSeccionReunion({
  texto,
  cantidad,
  ancho = "grupo",
}: {
  texto: string;
  cantidad?: number;
  ancho?: "grupo" | "modulo";
}) {
  return (
    <h2
      className={cn(
        "flex items-center gap-2 px-4 pt-[22px] pb-2 text-[13px] font-semibold text-muted-foreground",
        "md:h-9 md:border-b md:border-border-subtle md:bg-muted md:px-5 md:py-0 md:font-medium md:text-foreground",
        ancho === "modulo" ? "lg:px-8" : "lg:px-6",
      )}
    >
      {texto}
      {cantidad !== undefined ? <span className="font-normal text-subtle-foreground">{cantidad}</span> : null}
    </h2>
  );
}
