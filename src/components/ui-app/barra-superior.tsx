"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BuscarPersonas } from "./buscar-personas";

export interface MigaDePan {
  href?: string;
  texto: string;
}

const ContextoMigas = createContext<{ migas: MigaDePan[]; fijar: (migas: MigaDePan[]) => void }>({ migas: [], fijar: () => {} });

export function MigasProvider({ children }: { children: ReactNode }) {
  const [migas, fijar] = useState<MigaDePan[]>([]);
  return <ContextoMigas.Provider value={{ migas, fijar }}>{children}</ContextoMigas.Provider>;
}

/** Cada pagina declara sus migas; la barra superior las muestra. */
export function Migas({ items }: { items: MigaDePan[] }) {
  const { fijar } = useContext(ContextoMigas);
  const clave = JSON.stringify(items);
  useEffect(() => {
    fijar(JSON.parse(clave));
    return () => fijar([]);
  }, [clave, fijar]);
  return null;
}

/** Barra de 52px: migas a la izquierda y busqueda de personas (Ctrl K) a la derecha. */
export function BarraSuperior() {
  const { migas } = useContext(ContextoMigas);

  return (
    <div className="flex h-[52px] shrink-0 items-center gap-3 border-b px-4 sm:px-6">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <nav aria-label="Migas de pan" className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-muted-foreground">
        {migas.map((miga, indice) => (
          <span key={`${miga.texto}-${indice}`} className="flex min-w-0 items-center gap-2">
            {indice > 0 ? <span aria-hidden className="text-subtle-foreground">/</span> : null}
            {miga.href && indice < migas.length - 1 ? (
              <Link href={miga.href} className="truncate hover:text-foreground">{miga.texto}</Link>
            ) : (
              <span className="truncate text-foreground">{miga.texto}</span>
            )}
          </span>
        ))}
      </nav>
      <BuscarPersonas />
    </div>
  );
}
