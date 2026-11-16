import type { Metadata } from "next";
import { requerirSesion } from "@/server/auth/session";
import { PaginaCompleta } from "@/components/ui-app/page-header";
import { Migas } from "@/components/ui-app/barra-superior";
import { BuscarPagina } from "./_components/buscar-pagina";

export const metadata: Metadata = { title: "Personas" };

/** Buscar personas: la búsqueda en vivo usa las mismas reglas que el buscador del escritorio (visibilidad, mínimo de letras, sin correo). */
export default async function BuscarPersonasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requerirSesion();
  const { q } = await searchParams;
  return (
    <PaginaCompleta>
      <Migas items={[{ texto: "Personas" }]} />
      <BuscarPagina inicial={q?.trim() ?? ""} />
    </PaginaCompleta>
  );
}
