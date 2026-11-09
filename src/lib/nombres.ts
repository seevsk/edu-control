const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y"]);

/** Google entrega nombres en cualquier capitalizacion ("SEBASTIAN JOSE"); se muestran en formato titulo. */
function formatoTitulo(texto: string): string {
  return texto
    .toLocaleLowerCase("es-PE")
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra, indice) =>
      indice > 0 && PARTICULAS.has(palabra) ? palabra : palabra.charAt(0).toLocaleUpperCase("es-PE") + palabra.slice(1),
    )
    .join(" ");
}

/** Primera palabra con sus particulas previas: "de la Cruz Rojas" -> "de la Cruz". */
function primeraPalabra(texto: string): string {
  const palabras = formatoTitulo(texto).split(" ");
  const indice = palabras.findIndex((palabra) => !PARTICULAS.has(palabra));
  return palabras.slice(0, indice === -1 ? 1 : indice + 1).join(" ");
}

/** Primer nombre + primer apellido: "Sebastian Salas". */
export function nombreCorto(nombre: string, apellidos?: string | null): string {
  const primerApellido = apellidos ? primeraPalabra(apellidos) : "";
  return `${primeraPalabra(nombre)} ${primerApellido}`.trim();
}
