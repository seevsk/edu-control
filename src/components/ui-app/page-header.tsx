import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Migas, type MigaDePan } from "./barra-superior";
import { FilaDesplazable } from "./fila-desplazable";

export type { MigaDePan };


export interface PestanaEncabezado {
  href: string;
  texto: string;
  activa: boolean;
  contador?: number;
}

/** Botón redondo de 44 px para acciones de encabezado en móvil (objetivo táctil mínimo). */
export const ACCION_MOVIL =
  "flex size-11 items-center justify-center rounded-full text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-[21px]";

/**
 * Encabezado de una pantalla principal en móvil (Claude Design, "Móvil · 390 px"): acciones como
 * íconos arriba a la derecha (siempre incluye Buscar personas), título grande y una línea de
 * contexto. Desde `md` se oculta: ahí manda el encabezado de escritorio de cada página.
 */
export function EncabezadoMovil({ titulo, contexto, acciones }: { titulo: string; contexto?: ReactNode; acciones?: ReactNode }) {
  return (
    <header className="px-4 pt-3 pb-2 md:hidden">
      <div className="-mx-2 flex h-11 items-center justify-end gap-1">
        {acciones}
        <Link href="/usuarios" aria-label="Buscar personas" className={ACCION_MOVIL}>
          <Search aria-hidden />
        </Link>
      </div>
      <h1 className="text-[30px] leading-tight font-bold tracking-[-0.03em]">{titulo}</h1>
      {contexto ? <div className="mt-1 text-sm text-muted-foreground">{contexto}</div> : null}
    </header>
  );
}

/** "‹ Tú" (o el destino que corresponda) arriba de una pantalla de detalle, solo en móvil. */
export function VolverMovil({ href, texto, className }: { href: string; texto: string; className?: string }) {
  return (
    <Link href={href} className={cn("-ml-2 flex h-11 w-fit items-center gap-0.5 pr-2 text-[15px] text-muted-foreground hover:text-foreground md:hidden", className)}>
      <ChevronLeft className="size-6" aria-hidden />
      {texto}
    </Link>
  );
}

/** Filtros en forma de chips (móvil): se ven de 34 px pero su área táctil mide 44 px; se desplazan si no caben. */
export function ChipsFiltro({ opciones, etiqueta, className }: { opciones: { href: string; texto: string; activa: boolean }[]; etiqueta: string; className?: string }) {
  return (
    <FilaDesplazable as="nav" aria-label={etiqueta} className={className} scrollerClassName="flex gap-2 px-4 pt-1.5 pb-2">
      {opciones.map((opcion) => (
        <Link
          key={opcion.href}
          href={opcion.href}
          scroll={false}
          aria-current={opcion.activa ? "page" : undefined}
          className={cn(
            "relative flex h-[34px] shrink-0 items-center rounded-full max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-[5px] max-md:after:content-[''] border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
            opcion.activa ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:text-foreground",
          )}
        >
          {opcion.texto}
        </Link>
      ))}
    </FilaDesplazable>
  );
}

/** Ocupa todo el ancho del area de contenido (anula el padding del layout mientras convivan paginas antiguas). */
export function PaginaCompleta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("-m-4 flex min-h-[calc(100%+2rem)] flex-col sm:-m-6 sm:min-h-[calc(100%+3rem)]", className)}>{children}</div>;
}

/** Migas, titulo, una linea de contexto, acciones a la derecha y pestañas debajo. */
export function PageHeader({
  migas,
  titulo,
  contexto,
  acciones,
  pestanas,
  extra,
  ocultarEnMovil = false,
  volver,
  accionesMovil,
}: {
  migas?: MigaDePan[];
  titulo: string;
  contexto?: ReactNode;
  acciones?: ReactNode;
  pestanas?: PestanaEncabezado[];
  extra?: ReactNode;
  /** La página usa <EncabezadoMovil> en móvil. */
  ocultarEnMovil?: boolean;
  /** Pantalla de detalle en móvil: "‹ Grupos" arriba (en lugar de las migas, que viven en la barra de escritorio). */
  volver?: { href: string; texto: string };
  /** Acciones de 44 px junto a "volver" en móvil; si se indican, `acciones` se ocultan en móvil. */
  accionesMovil?: ReactNode;
}) {
  return (
    <header className={cn("border-b px-4 pt-4 sm:px-6", volver && "max-md:pt-1", !pestanas?.length && "pb-4", ocultarEnMovil && "max-md:hidden")}>
      {migas?.length ? <Migas items={migas} /> : null}
      {volver ? (
        <div className="-mx-2 mb-1 flex h-11 items-center md:hidden">
          <Link href={volver.href} className="flex h-11 items-center gap-0.5 pr-2 text-[15px] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-6" aria-hidden />
            {volver.texto}
          </Link>
          <span className="flex-1" />
          {accionesMovil}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className={cn("text-xl font-semibold tracking-[-0.01em] text-balance", volver && "max-md:text-[22px] max-md:font-bold max-md:tracking-[-0.02em]")}>{titulo}</h1>
          {contexto ? <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">{contexto}</div> : null}
        </div>
        {acciones ? <div className={cn("flex flex-wrap items-center gap-2", accionesMovil !== undefined && "max-md:hidden")}>{acciones}</div> : null}
      </div>
      {extra}
      {pestanas?.length ? (
        <FilaDesplazable as="nav" aria-label="Secciones" className="-mx-4 mt-3.5 -mb-px sm:mx-0" scrollerClassName="flex gap-5 px-4 text-sm sm:px-0 md:text-[13px]">
          {pestanas.map((pestana) => (
            <Link
              key={pestana.href}
              href={pestana.href}
              aria-current={pestana.activa ? "page" : undefined}
              className={cn(
                "border-b-2 py-3 whitespace-nowrap md:py-2",
                pestana.activa ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {pestana.texto}
              {pestana.contador !== undefined ? <span className="ml-1.5 text-subtle-foreground">{pestana.contador}</span> : null}
            </Link>
          ))}
        </FilaDesplazable>
      ) : null}
    </header>
  );
}
