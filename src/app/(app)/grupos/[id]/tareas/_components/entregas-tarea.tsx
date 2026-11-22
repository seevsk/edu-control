import Link from "next/link";
import { ChevronRight, Download, ExternalLink, Send } from "lucide-react";
import { esAutoaprobada, extensionDe, formatoTamano, resultadoVisible, type ResultadoEntrega } from "@/lib/entregas";
import { formatearFechaHoraLima } from "@/lib/dates";
import { nombreCorto } from "@/lib/nombres";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { Button } from "@/components/ui/button";
import type { obtenerTareaDelGrupo } from "@/server/services/tarea";
import { EtiquetaResultado } from "./etiqueta-resultado";

type Tarea = Awaited<ReturnType<typeof obtenerTareaDelGrupo>>;
type Entrega = Tarea["entregas"][number];

function dominio(enlace: string) {
  try {
    return new URL(enlace).host;
  } catch {
    return enlace;
  }
}

function TarjetaEntrega({ entrega, estadoTarea, vigente = true }: { entrega: Entrega; estadoTarea: string; vigente?: boolean }) {
  // Una entrega anterior nunca espera revisión (datos viejos pueden haberla dejado así).
  const resultado = vigente || entrega.resultado !== "en_revision" ? resultadoVisible(entrega.resultado as ResultadoEntrega, estadoTarea) : null;
  const autoaprobada = esAutoaprobada(entrega);
  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-3.5 text-card-foreground">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {resultado ? <EtiquetaResultado resultado={resultado} /> : null}
        <span className="flex items-center gap-1.5">
          <UserAvatar usuario={entrega.autor} />
          {nombreCorto(entrega.autor.nombre, entrega.autor.apellidos)}
        </span>
        <time dateTime={entrega.fechaEnvio.toISOString()} title={formatearFechaHoraLima(entrega.fechaEnvio)}>
          {formatearFechaHoraLima(entrega.fechaEnvio)}
        </time>
      </header>

      <div className="flex flex-col gap-1.5">
        <h4 className="text-sm font-medium break-words">{entrega.titulo}</h4>
        {entrega.descripcion ? <p className="text-[13px] whitespace-pre-wrap break-words text-muted-foreground">{entrega.descripcion}</p> : null}
        {entrega.enlace ? (
          <a
            href={entrega.enlace}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex w-fit max-w-full items-center gap-1.5 text-[13px] text-primary underline-offset-2 hover:underline max-md:min-h-11"
          >
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{dominio(entrega.enlace)}</span>
          </a>
        ) : null}
      </div>

      {entrega.archivos.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {entrega.archivos.map((archivo) => (
            <li key={archivo.idArchivo}>
              <a
                href={`/api/entregas/archivos/${archivo.idArchivo}`}
                download
                className="flex items-center gap-3 rounded-md border px-2.5 py-2 text-[13px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary max-md:min-h-11"
              >
                <span className="w-9 shrink-0 rounded bg-muted px-1 py-0.5 text-center font-mono text-[10px] font-medium uppercase text-muted-foreground">
                  {extensionDe(archivo.nombre).slice(0, 4)}
                </span>
                <span className="min-w-0 flex-1 truncate">{archivo.nombre}</span>
                <span className="shrink-0 text-xs text-subtle-foreground">{formatoTamano(archivo.tamano)}</span>
                <Download className="size-4 shrink-0 text-muted-foreground" aria-label="Descargar" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {entrega.revisor && entrega.fechaRevision ? (
        <footer className="flex flex-col gap-1.5 border-t pt-2.5 text-xs text-muted-foreground">
          <p>
            {entrega.resultado === "aprobada" ? (autoaprobada ? "Aprobada por el propio líder" : "Aprobada por") : "Devuelta por"}
            {autoaprobada ? "" : ` ${nombreCorto(entrega.revisor.nombre, entrega.revisor.apellidos)}`}
            {" · "}
            {formatearFechaHoraLima(entrega.fechaRevision)}
          </p>
          {entrega.motivoDevolucion ? (
            <p className="rounded-md bg-muted px-2.5 py-2 text-[13px] whitespace-pre-wrap break-words text-foreground">“{entrega.motivoDevolucion}”</p>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}

/**
 * Entregas de la tarea: la vigente arriba y las anteriores colapsadas. La acción de enviar solo la
 * ve el responsable; aprobar o devolver vive en "Siguiente acción" y solo la ve el líder.
 */
export function EntregasTarea({
  tarea,
  hrefEntregar,
  puedeEntregar,
}: {
  tarea: Tarea;
  /** Enlace que abre el formulario de envío; null si el usuario no puede enviar ahora. */
  hrefEntregar: string | null;
  puedeEntregar: boolean;
}) {
  const [vigente, ...anteriores] = tarea.entregas;
  if (!vigente && !puedeEntregar) return null;

  return (
    <section aria-labelledby="entregas-tarea" className="flex flex-col gap-3 border-t pt-5">
      <div className="flex items-center gap-2">
        <h3 id="entregas-tarea" className="text-[13px] font-medium">
          Entregas
        </h3>
        {tarea.entregas.length > 0 ? <span className="text-xs text-subtle-foreground">{tarea.entregas.length}</span> : null}
        {puedeEntregar && hrefEntregar ? (
          <Button size="sm" className="ml-auto h-8 max-md:h-11" asChild>
            <Link href={hrefEntregar} scroll={false}>
              <Send aria-hidden />
              Enviar a revisión
            </Link>
          </Button>
        ) : null}
      </div>

      {vigente ? <TarjetaEntrega entrega={vigente} estadoTarea={tarea.estado} /> : <p className="text-[13px] text-muted-foreground">Aún sin entregas.</p>}

      {anteriores.length > 0 ? (
        <details className="group flex flex-col gap-3">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground max-md:min-h-11 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
            Entregas anteriores
            <span className="text-subtle-foreground">{anteriores.length}</span>
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {anteriores.map((entrega) => (
              <TarjetaEntrega key={entrega.idEntrega} entrega={entrega} estadoTarea={tarea.estado} vigente={false} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
