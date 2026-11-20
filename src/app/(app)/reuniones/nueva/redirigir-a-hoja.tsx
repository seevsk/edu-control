"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEsMovil } from "@/hooks/use-es-movil";

/**
 * En móvil, programar una reunión de un grupo es una hoja inferior sobre la pestaña Reuniones del
 * grupo. Los enlaces a /reuniones/nueva?grupo= (Horarios, Calendario) se reenvían allí con sus
 * parámetros; sin grupo se conserva esta página con su selector.
 */
export function RedirigirAHojaEnMovil({ idGrupo, parametros }: { idGrupo: number; parametros: Record<string, string | undefined> }) {
  const router = useRouter();
  const movil = useEsMovil();
  useEffect(() => {
    if (!movil) return;
    const consulta = new URLSearchParams({ programar: "1" });
    for (const [clave, valor] of Object.entries(parametros)) if (valor) consulta.set(clave, valor);
    router.replace(`/grupos/${idGrupo}/reuniones?${consulta.toString()}`, { scroll: false });
  }, [movil, idGrupo, parametros, router]);
  return null;
}
