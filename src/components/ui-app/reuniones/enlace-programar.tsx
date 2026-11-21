"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { useEsMovil } from "@/hooks/use-es-movil";

/**
 * "Programar reunión" de un grupo: hoja inferior en móvil, página /reuniones/nueva en tablet y
 * escritorio. Reenvía las props para usarse con `asChild` (menús de Radix).
 */
export function EnlaceProgramarReunion({ idGrupo, ...props }: { idGrupo: number } & Omit<ComponentProps<typeof Link>, "href">) {
  const movil = useEsMovil();
  return <Link {...props} href={movil ? `/grupos/${idGrupo}/reuniones?programar=1` : `/reuniones/nueva?grupo=${idGrupo}`} />;
}
