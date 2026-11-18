/**
 * Reglas puras de las entregas de tarea (limites y tipos de archivo). Los topes son de la demo:
 * los archivos viven en Postgres, que en el plan gratuito de Render comparte 1 GB con todo lo demas.
 */
export const MB = 1024 * 1024;

export const LIMITES_ENTREGA = {
  bytesPorArchivo: 5 * MB,
  archivosPorEntrega: 3,
  bytesPorEntrega: 10 * MB,
  bytesPorGrupo: 40 * MB,
} as const;

interface TipoPermitido {
  extension: string;
  mimes: string[];
  /** Cabecera del archivo: evita que un .exe renombrado a .pdf pase solo por la extension. */
  firma: number[];
  etiqueta: string;
}

const ZIP = [0x50, 0x4b, 0x03, 0x04];

export const TIPOS_PERMITIDOS: TipoPermitido[] = [
  { extension: "pdf", mimes: ["application/pdf"], firma: [0x25, 0x50, 0x44, 0x46], etiqueta: "PDF" },
  { extension: "docx", mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], firma: ZIP, etiqueta: "Word" },
  { extension: "pptx", mimes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"], firma: ZIP, etiqueta: "PowerPoint" },
  { extension: "xlsx", mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], firma: ZIP, etiqueta: "Excel" },
  { extension: "png", mimes: ["image/png"], firma: [0x89, 0x50, 0x4e, 0x47], etiqueta: "PNG" },
  { extension: "jpg", mimes: ["image/jpeg"], firma: [0xff, 0xd8, 0xff], etiqueta: "JPG" },
  { extension: "jpeg", mimes: ["image/jpeg"], firma: [0xff, 0xd8, 0xff], etiqueta: "JPG" },
];

/** Para el atributo `accept` del selector de archivos. */
export const ACCEPT_ARCHIVOS = TIPOS_PERMITIDOS.map((tipo) => `.${tipo.extension}`).join(",");

export function extensionDe(nombre: string) {
  const punto = nombre.lastIndexOf(".");
  return punto === -1 ? "" : nombre.slice(punto + 1).toLowerCase();
}

export function tipoPermitido(nombre: string) {
  const extension = extensionDe(nombre);
  return TIPOS_PERMITIDOS.find((tipo) => tipo.extension === extension) ?? null;
}

/** MIME canonico segun la extension (el que manda el navegador no es de fiar). */
export function mimeDe(nombre: string) {
  return tipoPermitido(nombre)?.mimes[0] ?? "application/octet-stream";
}

export function firmaCoincide(nombre: string, inicio: Uint8Array) {
  const tipo = tipoPermitido(nombre);
  if (!tipo || inicio.length < tipo.firma.length) return false;
  return tipo.firma.every((byte, indice) => inicio[indice] === byte);
}

export function formatoTamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(1).replace(".", ",")} MB`;
}

export interface ArchivoCandidato {
  nombre: string;
  tamano: number;
}

/**
 * Valida el conjunto de archivos de una entrega. Devuelve el primer mensaje de error o null.
 * Se usa igual en el cliente (comodidad) y en el servidor (la regla que vale).
 */
export function validarArchivosEntrega(archivos: ArchivoCandidato[], bytesUsadosGrupo = 0): string | null {
  if (archivos.length > LIMITES_ENTREGA.archivosPorEntrega) {
    return `Máximo ${LIMITES_ENTREGA.archivosPorEntrega} archivos por entrega`;
  }
  let total = 0;
  for (const archivo of archivos) {
    if (!tipoPermitido(archivo.nombre)) {
      return `“${archivo.nombre}” no es un tipo permitido (PDF, Word, PowerPoint, Excel, PNG o JPG)`;
    }
    if (archivo.tamano <= 0) return `“${archivo.nombre}” está vacío`;
    if (archivo.tamano > LIMITES_ENTREGA.bytesPorArchivo) {
      return `“${archivo.nombre}” supera los ${LIMITES_ENTREGA.bytesPorArchivo / MB} MB por archivo`;
    }
    total += archivo.tamano;
  }
  if (total > LIMITES_ENTREGA.bytesPorEntrega) {
    return `Los archivos superan los ${LIMITES_ENTREGA.bytesPorEntrega / MB} MB por entrega`;
  }
  if (bytesUsadosGrupo + total > LIMITES_ENTREGA.bytesPorGrupo) {
    return "El grupo alcanzó su espacio para archivos. Usa un enlace";
  }
  return null;
}

/** Una entrega necesita titulo y algo que revisar: descripcion, enlace o al menos un archivo. */
export function tieneContenidoEntrega(datos: { descripcion?: string | null; enlace?: string | null }, cantidadArchivos: number) {
  return Boolean(datos.descripcion?.trim() || datos.enlace?.trim() || cantidadArchivos > 0);
}

export type ResultadoEntrega = "en_revision" | "aprobada" | "devuelta";

export const ETIQUETA_RESULTADO_ENTREGA: Record<ResultadoEntrega, string> = {
  en_revision: "En revisión",
  aprobada: "Aprobada",
  devuelta: "Devuelta",
};

/**
 * Resultado a mostrar. Una entrega "en revision" de una tarea que ya no esta en revision
 * (la descartaron) no se etiqueta: no esta esperando a nadie.
 */
export function resultadoVisible(resultado: ResultadoEntrega, estadoTarea: string): ResultadoEntrega | null {
  if (resultado === "en_revision" && estadoTarea !== "en_revision") return null;
  return resultado;
}

export function esAutoaprobada(entrega: { resultado: string; idRevisor: number | null; idAutor: number }) {
  return entrega.resultado === "aprobada" && entrega.idRevisor !== null && entrega.idRevisor === entrega.idAutor;
}
