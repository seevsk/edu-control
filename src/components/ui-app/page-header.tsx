import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MigaDePan {
  href?: string;
  texto: string;
}

export interface PestanaEncabezado {
  href: string;
  texto: string;
  activa: boolean;
  contador?: number;
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
}: {
  migas?: MigaDePan[];
  titulo: string;
  contexto?: ReactNode;
  acciones?: ReactNode;
  pestanas?: PestanaEncabezado[];
  extra?: ReactNode;
}) {
  return (
    <header className={cn("border-b px-4 pt-4 sm:px-6", !pestanas?.length && "pb-4")}>
      {migas?.length ? (
        <nav aria-label="Migas de pan" className="flex items-center gap-2 text-[13px] text-subtle-foreground">
          {migas.map((miga, indice) => (
            <span key={`${miga.texto}-${indice}`} className="flex items-center gap-2">
              {indice > 0 ? <span aria-hidden>/</span> : null}
              {miga.href ? (
                <Link href={miga.href} className="hover:text-foreground">{miga.texto}</Link>
              ) : (
                <span className="text-foreground">{miga.texto}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", migas?.length && "mt-2.5")}>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-balance">{titulo}</h1>
          {contexto ? <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">{contexto}</div> : null}
        </div>
        {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
      </div>
      {extra}
      {pestanas?.length ? (
        <nav aria-label="Secciones" className="-mb-px mt-3.5 flex gap-5 overflow-x-auto text-[13px]">
          {pestanas.map((pestana) => (
            <Link
              key={pestana.href}
              href={pestana.href}
              aria-current={pestana.activa ? "page" : undefined}
              className={cn(
                "border-b-2 py-2 whitespace-nowrap",
                pestana.activa ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {pestana.texto}
              {pestana.contador !== undefined ? <span className="ml-1.5 text-subtle-foreground">{pestana.contador}</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
