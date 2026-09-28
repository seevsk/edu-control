/** Deriva un color estable para la tarjeta de un curso a partir de su nombre/codigo. Sin columna de color en la BD. */
export function colorCurso(semilla: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < semilla.length; i++) {
    hash = (hash << 5) - hash + semilla.charCodeAt(i);
    hash |= 0;
  }
  const tono = Math.abs(hash) % 360;
  return {
    bg: `hsl(${tono} 55% 40%)`,
    fg: "#ffffff",
  };
}

export function inicialesCurso(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return `${palabras[0][0]}${palabras[1][0]}`.toUpperCase();
}
