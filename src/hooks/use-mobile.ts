import * as React from "react"

/**
 * Debajo de `lg` (1024 px) el menú lateral completo no ocupa espacio: en móvil hay barra inferior
 * y en tablet un riel de 80 px; el menú completo se abre como hoja desde el riel ("Menú").
 */
const BREAKPOINT_MENU_COMPLETO = 1024
const CONSULTA = `(max-width: ${BREAKPOINT_MENU_COMPLETO - 1}px)`

function suscribir(alCambiar: () => void) {
  const mql = window.matchMedia(CONSULTA)
  mql.addEventListener("change", alCambiar)
  return () => mql.removeEventListener("change", alCambiar)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  )
}
