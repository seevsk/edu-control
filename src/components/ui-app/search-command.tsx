"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserSearch } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { CourseDot } from "./course-dot";

const MIN_CARACTERES_PERSONAS = 3;

export interface DestinoBusqueda {
  href: string;
  texto: string;
  idCurso?: number;
}

/** "Buscar (Ctrl K)": salta a cursos, grupos o paginas, y busca personas con las reglas de /usuarios. */
export function SearchCommand({ paginas, cursos, grupos }: {
  paginas: DestinoBusqueda[];
  cursos: DestinoBusqueda[];
  grupos: DestinoBusqueda[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key.toLowerCase() === "k" && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault();
        setAbierto((actual) => !actual);
      }
    }
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, []);

  function ir(href: string) {
    setAbierto(false);
    setConsulta("");
    router.push(href);
  }

  const textoPersonas = consulta.trim();

  return (
    <>
      <SidebarMenuButton
        onClick={() => setAbierto(true)}
        tooltip="Buscar (Ctrl K)"
        className="border border-sidebar-border bg-background text-subtle-foreground hover:text-foreground"
      >
        <Search aria-hidden />
        <span className="flex-1">Buscar</span>
        <kbd className="font-mono text-[11px] group-data-[collapsible=icon]:hidden">Ctrl K</kbd>
      </SidebarMenuButton>
      <CommandDialog open={abierto} onOpenChange={setAbierto} title="Buscar" description="Busca cursos, grupos, páginas o personas">
        <CommandInput placeholder="Buscar cursos, grupos o personas" value={consulta} onValueChange={setConsulta} />
        <CommandList>
          <CommandEmpty>No hay coincidencias.</CommandEmpty>
          {textoPersonas.length >= MIN_CARACTERES_PERSONAS ? (
            <CommandGroup heading="Personas">
              <CommandItem
                value={`personas ${textoPersonas}`}
                onSelect={() => ir(`/usuarios?q=${encodeURIComponent(textoPersonas)}`)}
              >
                <UserSearch aria-hidden />
                Buscar personas: “{textoPersonas}”
              </CommandItem>
            </CommandGroup>
          ) : null}
          {cursos.length ? (
            <CommandGroup heading="Cursos">
              {cursos.map((curso) => (
                <CommandItem key={curso.href} value={`curso ${curso.texto}`} onSelect={() => ir(curso.href)}>
                  {curso.idCurso !== undefined ? <CourseDot idCurso={curso.idCurso} /> : null}
                  {curso.texto}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {grupos.length ? (
            <CommandGroup heading="Grupos">
              {grupos.map((grupo) => (
                <CommandItem key={grupo.href} value={`grupo ${grupo.texto}`} onSelect={() => ir(grupo.href)}>
                  {grupo.texto}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          <CommandGroup heading="Ir a">
            {paginas.map((pagina) => (
              <CommandItem key={pagina.href} value={`pagina ${pagina.texto}`} onSelect={() => ir(pagina.href)}>
                {pagina.texto}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
