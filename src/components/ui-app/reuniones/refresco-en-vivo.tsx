"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mientras se muestra una reunión con la sala abierta, vuelve a pedir la página cada cierto tiempo
 * (solo con la pestaña visible) para que "Unirse" desaparezca cuando otra persona termina la
 * reunión. No hay webhooks ni conexión en vivo: la app consulta, y el servidor cierra las salas
 * vacías al responder.
 */
export function RefrescoEnVivo({ cadaSegundos = 15 }: { cadaSegundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const intervalo = setInterval(refrescar, cadaSegundos * 1000);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [router, cadaSegundos]);
  return null;
}
