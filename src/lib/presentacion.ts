/** Helpers de presentacion: nunca cambian datos, solo como se muestran. */

const TONOS = 8;

function tono(id: number): number {
  return ((id % TONOS) + TONOS) % TONOS;
}

/** Color del curso derivado de su id (no hay columna de color en la BD). */
export function colorCurso(idCurso: number): string {
  return `var(--curso-${tono(idCurso)})`;
}

/** Avatar: iniciales sobre un fondo tenue del mismo tono que el texto, derivado del id del usuario. */
export function colorAvatar(idUsuario: number): { backgroundColor: string; color: string } {
  const base = `var(--curso-${tono(idUsuario * 3 + 1)})`;
  return {
    backgroundColor: `color-mix(in oklab, ${base} 22%, var(--background))`,
    color: `color-mix(in oklab, ${base} 75%, var(--foreground))`,
  };
}

/** "PROYECTO TECNOLOGICO" -> "Proyecto tecnologico". Solo actua si el texto viene todo en mayusculas. */
export function aOracion(texto: string): string {
  const limpio = texto.trim();
  if (!limpio || limpio !== limpio.toLocaleUpperCase("es-PE") || limpio === limpio.toLocaleLowerCase("es-PE")) {
    return limpio;
  }
  const minusculas = limpio.toLocaleLowerCase("es-PE");
  return minusculas.charAt(0).toLocaleUpperCase("es-PE") + minusculas.slice(1);
}

export function iniciales(nombre: string, apellidos?: string | null): string {
  const primera = nombre.trim().charAt(0);
  const segunda = (apellidos ?? "").trim().charAt(0) || nombre.trim().split(/\s+/)[1]?.charAt(0) || "";
  return `${primera}${segunda}`.toLocaleUpperCase("es-PE") || "?";
}

/** Aviso del dialogo al quitar una evaluacion o un curso: cuantos grupos quedan desvinculados (vacio si ninguno). */
export function avisoGruposDesvinculados(cantidad: number, objeto: "evaluación" | "curso"): string {
  if (cantidad <= 0) return "";
  return cantidad === 1
    ? ` 1 grupo dejará de estar vinculado a ${objeto === "curso" ? "este curso" : "esta evaluación"}.`
    : ` ${cantidad} grupos dejarán de estar vinculados a ${objeto === "curso" ? "este curso" : "esta evaluación"}.`;
}
