import { useSyncExternalStore } from "react";

/** Móvil = menos de 768 px (`md` de Tailwind). Distinto de useIsMobile, que es el corte del menú lateral (1024 px). */
const CONSULTA = "(max-width: 767px)";

function suscribir(alCambiar: () => void) {
  const consulta = window.matchMedia(CONSULTA);
  consulta.addEventListener("change", alCambiar);
  return () => consulta.removeEventListener("change", alCambiar);
}

export function useEsMovil() {
  return useSyncExternalStore(suscribir, () => window.matchMedia(CONSULTA).matches, () => false);
}
