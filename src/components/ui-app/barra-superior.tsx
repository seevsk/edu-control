"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

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
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key.toLowerCase() === "k" && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault();
        entrada.current?.focus();
      }
    }
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, []);

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
      <form
        role="search"
        onSubmit={(evento) => {
          evento.preventDefault();
          const consulta = entrada.current?.value.trim() ?? "";
          if (consulta) router.push(`/usuarios?q=${encodeURIComponent(consulta)}`);
        }}
        className="flex h-8 w-full max-w-[300px] items-center gap-2 rounded-md border border-transparent bg-secondary px-2.5 text-subtle-foreground focus-within:border-ring max-sm:max-w-[45%]"
      >
        <Users className="size-3.5 shrink-0" aria-hidden />
        <label className="sr-only" htmlFor="buscar-personas">Buscar personas</label>
        <input
          ref={entrada}
          id="buscar-personas"
          type="search"
          placeholder="Buscar personas…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-subtle-foreground"
        />
        <kbd className="hidden rounded border border-input px-1.5 font-mono text-[11px] sm:inline">Ctrl K</kbd>
      </form>
    </div>
  );
}
