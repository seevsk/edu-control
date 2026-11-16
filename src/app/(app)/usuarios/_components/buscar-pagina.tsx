"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { nombreCorto } from "@/lib/nombres";
import { buscarPersonasAction } from "../actions";

type Persona = Awaited<ReturnType<typeof buscarPersonasAction>>[number];

const ESPERA_MS = 200;
const MIN_CARACTERES = 3;

function detalle(persona: Persona) {
  return [persona.carrera, persona.institucion, persona.ciclo ? `${persona.ciclo}.º ciclo` : null].filter(Boolean).join(" · ");
}

function Fila({ persona }: { persona: Persona }) {
  return (
    <li>
      <Link href={`/usuarios/${persona.idUsuario}`} className="flex min-h-16 items-center gap-3 border-b border-border-subtle px-4 py-2.5 hover:bg-muted md:min-h-12 md:px-6">
        <UserAvatar usuario={persona} tamano="lg" className="size-9 md:size-8" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] md:text-sm">{nombreCorto(persona.nombre, persona.apellidos)}</span>
          {detalle(persona) ? <span className="block truncate text-[13px] text-subtle-foreground md:text-xs">{detalle(persona)}</span> : null}
        </span>
        {persona.gruposEnComun ? (
          <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            {persona.gruposEnComun} {persona.gruposEnComun === 1 ? "grupo" : "grupos"}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/** Buscar personas a pantalla completa (Claude Design, "Móvil · Buscar"): en vivo, compañeros primero, nunca el correo. */
export function BuscarPagina({ inicial }: { inicial: string }) {
  const router = useRouter();
  const [consulta, setConsulta] = useState(inicial);
  const [resultados, setResultados] = useState<Persona[]>([]);
  const [buscando, iniciar] = useTransition();
  const texto = consulta.trim();

  useEffect(() => {
    if (texto.length < MIN_CARACTERES) return;
    const temporizador = setTimeout(() => {
      iniciar(async () => setResultados(await buscarPersonasAction(texto)));
    }, ESPERA_MS);
    return () => clearTimeout(temporizador);
  }, [texto]);

  const visibles = texto.length >= MIN_CARACTERES ? resultados : [];
  const companeros = visibles.filter((persona) => persona.gruposEnComun > 0);
  const otras = visibles.filter((persona) => persona.gruposEnComun === 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <h1 className="px-4 pt-4 pb-2 text-[30px] leading-tight font-bold tracking-[-0.03em] md:px-6 md:pt-6 md:text-xl md:font-semibold md:tracking-normal">Buscar personas</h1>
      <div className="flex items-center gap-3 px-4 pb-3 md:px-6">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-secondary px-3 text-subtle-foreground focus-within:ring-2 focus-within:ring-ring md:h-9 md:rounded-md">
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="sr-only">Nombre o correo exacto</span>
          <input
            type="search"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Nombre o correo exacto"
            autoFocus
            enterKeyHint="search"
            className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-subtle-foreground md:text-sm"
          />
        </label>
        <button type="button" onClick={() => router.back()} className="h-11 text-[15px] text-muted-foreground hover:text-foreground md:hidden">Cancelar</button>
      </div>

      {texto.length > 0 && texto.length < MIN_CARACTERES ? (
        <p className="px-4 py-3 text-sm text-subtle-foreground md:px-6">Escribe al menos {MIN_CARACTERES} letras o el correo exacto.</p>
      ) : null}
      {texto.length >= MIN_CARACTERES && !visibles.length ? (
        <p className="px-4 py-3 text-sm text-subtle-foreground md:px-6">{buscando ? "Buscando…" : "Nadie coincide con esa búsqueda."}</p>
      ) : null}

      {companeros.length ? (
        <section aria-label="Compañeros">
          <h2 className="px-4 pt-4 pb-2 text-[13px] font-semibold text-muted-foreground md:px-6">Compañeros</h2>
          <ul className="border-t border-border-subtle">{companeros.map((persona) => <Fila key={persona.idUsuario} persona={persona} />)}</ul>
        </section>
      ) : null}
      {otras.length ? (
        <section aria-label="Otras personas">
          <h2 className="px-4 pt-4 pb-2 text-[13px] font-semibold text-muted-foreground md:px-6">Otras personas</h2>
          <ul className="border-t border-border-subtle">{otras.map((persona) => <Fila key={persona.idUsuario} persona={persona} />)}</ul>
        </section>
      ) : null}
      {visibles.length ? <p className="px-4 py-4 text-xs text-subtle-foreground md:px-6">Solo aparecen quienes permiten ser encontrados.</p> : null}
    </div>
  );
}
