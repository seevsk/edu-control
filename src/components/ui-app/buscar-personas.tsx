"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import { UserAvatar } from "./user-avatar";
import { nombreCorto } from "@/lib/nombres";
import { buscarPersonasAction } from "@/app/(app)/usuarios/actions";

type Persona = Awaited<ReturnType<typeof buscarPersonasAction>>[number];

const ESPERA_MS = 200;
const MIN_CARACTERES = 3;

function detalle(persona: Persona) {
  return [persona.carrera, persona.institucion, persona.ciclo ? `${persona.ciclo}.º ciclo` : null].filter(Boolean).join(" · ");
}

function Fila({ persona, alElegir }: { persona: Persona; alElegir: (idUsuario: number) => void }) {
  return (
    <CommandItem value={String(persona.idUsuario)} onSelect={() => alElegir(persona.idUsuario)} className="gap-2.5 px-2.5 py-2">
      <UserAvatar usuario={persona} tamano="lg" className="size-7" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{nombreCorto(persona.nombre, persona.apellidos)}</span>
        {detalle(persona) ? <span className="block truncate text-xs text-subtle-foreground">{detalle(persona)}</span> : null}
      </span>
      {persona.gruposEnComun ? (
        <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {persona.gruposEnComun} {persona.gruposEnComun === 1 ? "grupo" : "grupos"}
        </span>
      ) : null}
    </CommandItem>
  );
}


/** Busqueda de personas del topbar (solo personas): en vivo, con teclado, compañeros primero. */
export function BuscarPersonas() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resultados, setResultados] = useState<Persona[]>([]);
  const [buscando, iniciar] = useTransition();
  const texto = consulta.trim();

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key.toLowerCase() === "k" && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault();
        entrada.current?.focus();
        setAbierto(true);
      }
    }
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, []);

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

  function abrir(idUsuario: number) {
    setAbierto(false);
    setConsulta("");
    entrada.current?.blur();
    router.push(`/usuarios/${idUsuario}`);
  }

  return (
    <Command
      shouldFilter={false}
      className="relative h-auto w-full max-w-[300px] overflow-visible bg-transparent max-sm:max-w-[50%]"
      onKeyDown={(evento) => {
        if (evento.key === "Escape") {
          setAbierto(false);
          entrada.current?.blur();
        }
      }}
    >
      <div className="flex h-8 items-center gap-2 rounded-md border border-transparent bg-secondary px-2.5 text-subtle-foreground focus-within:border-input">
        <Users className="size-3.5 shrink-0" aria-hidden />
        <CommandPrimitive.Input
          ref={entrada}
          value={consulta}
          onValueChange={(valor) => { setConsulta(valor); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder="Buscar personas…"
          aria-label="Buscar personas"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-subtle-foreground"
        />
        <kbd className="hidden rounded border border-input px-1.5 font-mono text-[11px] sm:inline">Ctrl K</kbd>
      </div>
      {abierto && texto ? (
        <div className="absolute top-[38px] right-0 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-[10px] border bg-popover p-1.5 shadow-pop">
          <CommandList className="max-h-[360px]">
            {texto.length < MIN_CARACTERES ? (
              <p className="px-2.5 py-3 text-[13px] text-subtle-foreground">Escribe al menos {MIN_CARACTERES} letras o el correo exacto.</p>
            ) : (
              <>
                <CommandEmpty className="px-2.5 py-3 text-[13px] text-subtle-foreground">
                  {buscando ? "Buscando…" : "Nadie coincide con esa búsqueda."}
                </CommandEmpty>
                {companeros.length ? (
                  <CommandGroup heading="Compañeros">
                    {companeros.map((persona) => <Fila key={persona.idUsuario} persona={persona} alElegir={abrir} />)}
                  </CommandGroup>
                ) : null}
                {otras.length ? (
                  <CommandGroup heading="Otras personas">
                    {otras.map((persona) => <Fila key={persona.idUsuario} persona={persona} alElegir={abrir} />)}
                  </CommandGroup>
                ) : null}
              </>
            )}
          </CommandList>
          <div className="mt-1.5 flex justify-between gap-3 border-t px-2.5 pt-2 pb-1 text-xs text-subtle-foreground">
            <span>Solo aparecen quienes permiten ser encontrados</span>
            <span className="hidden whitespace-nowrap sm:inline">↑ ↓ para moverte</span>
          </div>
        </div>
      ) : null}
    </Command>
  );
}
