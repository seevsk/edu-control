"use client";

import { useEffect, useState } from "react";
import { estadoReunion, type DatosEstadoReunion } from "@/lib/estado-reunion";
import { EstadoReunion } from "./estado-reunion";
import { varianteDeEstado } from "./formato";

/**
 * Hora actual del cliente, refrescada cada `cadaMs`. Arranca con la hora que entregó el servidor
 * (así el HTML inicial coincide) y se recalcula al volver a la pestaña.
 */
export function useAhora(ahoraInicial: string, cadaMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date(ahoraInicial));

  useEffect(() => {
    const actualizar = () => setAhora(new Date());
    const intervalo = setInterval(actualizar, cadaMs);
    const alVolver = () => {
      if (document.visibilityState === "visible") actualizar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cadaMs]);

  return ahora;
}

/** Etiqueta de estado que se recalcula sola cada 30 s ("Empieza en 25 min", "Cierra en 4 min"…). */
export function EstadoReunionVivo({
  reunion,
  ahoraInicial,
  tamano,
  className,
}: {
  reunion: DatosEstadoReunion;
  ahoraInicial: string;
  tamano?: "md" | "lg";
  className?: string;
}) {
  const ahora = useAhora(ahoraInicial);
  const estado = estadoReunion(reunion, ahora);
  return <EstadoReunion {...varianteDeEstado(estado, reunion, ahora)} tamano={tamano} className={className} />;
}
