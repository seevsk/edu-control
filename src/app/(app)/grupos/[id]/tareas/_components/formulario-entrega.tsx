"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCEPT_ARCHIVOS,
  extensionDe,
  formatoTamano,
  LIMITES_ENTREGA,
  MB,
  validarArchivosEntrega,
} from "@/lib/entregas";

const CAMPO = "flex flex-col gap-1.5 text-[13px] font-medium";
const CONTADOR = "text-xs font-normal text-subtle-foreground";

/**
 * Formulario de envío a revisión. Sube con XMLHttpRequest para mostrar el progreso real; el servidor
 * valida todo otra vez (esto solo evita viajes inútiles).
 */
export function FormularioEntrega({
  idGrupo,
  idTarea,
  hrefVolver,
  motivoAnterior,
}: {
  idGrupo: number;
  idTarea: number;
  /** Detalle de la tarea: a donde se vuelve al cancelar o al terminar. */
  hrefVolver: string;
  /** Motivo con el que el líder devolvió la entrega anterior, para tenerlo a la vista. */
  motivoAnterior?: string | null;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enlace, setEnlace] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const enviando = progreso !== null;

  const total = archivos.reduce((suma, archivo) => suma + archivo.size, 0);

  function agregar(nuevos: FileList | File[]) {
    const candidatos = [...archivos];
    for (const archivo of Array.from(nuevos)) {
      if (!candidatos.some((existente) => existente.name === archivo.name && existente.size === archivo.size)) candidatos.push(archivo);
    }
    const problema = validarArchivosEntrega(candidatos.map((archivo) => ({ nombre: archivo.name, tamano: archivo.size })));
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setArchivos(candidatos);
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    if (!titulo.trim()) return setError("El título es obligatorio");
    if (!descripcion.trim() && !enlace.trim() && archivos.length === 0) {
      return setError("Agrega una descripción, un enlace o al menos un archivo");
    }
    if (enlace.trim() && !/^https?:\/\//i.test(enlace.trim())) return setError("El enlace debe empezar con http:// o https://");

    const datos = new FormData();
    datos.set("idGrupo", String(idGrupo));
    datos.set("idTarea", String(idTarea));
    datos.set("titulo", titulo);
    datos.set("descripcion", descripcion);
    datos.set("enlace", enlace);
    for (const archivo of archivos) datos.append("archivos", archivo);

    setError(null);
    setProgreso(0);
    const peticion = new XMLHttpRequest();
    peticion.open("POST", "/api/entregas");
    peticion.responseType = "json";
    peticion.upload.onprogress = (progresoEvento) => {
      if (progresoEvento.lengthComputable) setProgreso(Math.round((progresoEvento.loaded / progresoEvento.total) * 100));
    };
    peticion.onerror = () => {
      setProgreso(null);
      setError("No se pudo enviar. Revisa tu conexión e intenta de nuevo; lo que escribiste se conserva");
    };
    peticion.onload = () => {
      if (peticion.status >= 200 && peticion.status < 300) {
        toast.success("Entrega enviada a revisión");
        router.push(hrefVolver, { scroll: false });
        router.refresh();
        return;
      }
      setProgreso(null);
      const respuesta = peticion.response as { error?: string } | null;
      setError(respuesta?.error ?? "No se pudo enviar la entrega");
    };
    peticion.send(datos);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      {motivoAnterior ? (
        <div className="rounded-md bg-muted px-3 py-2.5 text-[13px]">
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">Motivo de la devolución</p>
          <p className="whitespace-pre-wrap break-words">“{motivoAnterior}”</p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <label className={CAMPO}>
        <span className="flex items-baseline justify-between">
          Título
          <span className={CONTADOR}>{titulo.length} / 120</span>
        </span>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} placeholder="Ej. Documento Avance 4 · v2" disabled={enviando} required />
      </label>

      <label className={CAMPO}>
        <span className="flex items-baseline justify-between">
          Descripción
          <span className={CONTADOR}>{descripcion.length} / 2000</span>
        </span>
        <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={2000} rows={4} placeholder="Qué entregas y dónde revisarlo" disabled={enviando} />
      </label>

      <label className={CAMPO}>
        <span className="flex items-baseline justify-between">
          Enlace
          <span className={CONTADOR}>opcional</span>
        </span>
        <Input type="url" inputMode="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://drive.google.com/…" disabled={enviando} />
      </label>

      <div className={CAMPO}>
        <span className="flex items-baseline justify-between">
          Archivos
          <span className={CONTADOR}>
            {archivos.length} / {LIMITES_ENTREGA.archivosPorEntrega} archivos · {(total / MB).toFixed(1).replace(".", ",")} / {LIMITES_ENTREGA.bytesPorEntrega / MB} MB
          </span>
        </span>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            if (!enviando) agregar(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center text-[13px] font-normal text-muted-foreground transition-colors ${arrastrando ? "border-primary bg-muted" : ""}`}
        >
          <Upload className="size-4" aria-hidden />
          <p>
            Arrastra archivos o{" "}
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              disabled={enviando}
              className="font-medium text-primary underline-offset-2 hover:underline max-md:min-h-11"
            >
              selecciona
            </button>
          </p>
          <p className="text-xs text-subtle-foreground">PDF, Word, PowerPoint, Excel, PNG o JPG · hasta {LIMITES_ENTREGA.bytesPorArchivo / MB} MB c/u</p>
          <input
            ref={entrada}
            type="file"
            multiple
            accept={ACCEPT_ARCHIVOS}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              if (e.target.files) agregar(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {archivos.length > 0 ? (
          <ul className="flex flex-col gap-1.5 font-normal">
            {archivos.map((archivo) => (
              <li key={`${archivo.name}-${archivo.size}`} className="flex items-center gap-3 rounded-md border px-2.5 py-2 max-md:min-h-11">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{archivo.name}</span>
                <span className="shrink-0 text-xs text-subtle-foreground">
                  {extensionDe(archivo.name).toUpperCase()} · {formatoTamano(archivo.size)}
                </span>
                <button
                  type="button"
                  aria-label={`Quitar ${archivo.name}`}
                  disabled={enviando}
                  onClick={() => setArchivos(archivos.filter((otro) => otro !== archivo))}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground max-md:size-11"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {enviando ? (
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso ?? 0} aria-label="Subiendo entrega" className="flex flex-col gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progreso}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{progreso === 100 ? "Guardando…" : `Subiendo ${progreso}%`}</p>
        </div>
      ) : null}

      <div className="flex items-center gap-2 max-md:flex-col-reverse max-md:items-stretch">
        <Button type="submit" disabled={enviando} className="max-md:h-12 max-md:rounded-xl">
          {enviando ? "Enviando…" : "Enviar a revisión"}
        </Button>
        <Button type="button" variant="ghost" disabled={enviando} className="max-md:h-11" onClick={() => router.push(hrefVolver, { scroll: false })}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
