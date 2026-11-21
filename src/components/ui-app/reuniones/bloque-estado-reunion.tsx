import { ExternalLink } from "lucide-react";
import { salaAbierta, ventanaSala, minutosHasta, type DatosEstadoReunion, type EstadoReunion as EstadoLogico } from "@/lib/estado-reunion";
import { fechaCorta, hora } from "@/lib/formato-fecha";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { AvataresApilados } from "./avatares-apilados";
import { BotonUnirse } from "./boton-unirse";
import { EstadoReunion } from "./estado-reunion";
import { duracionEntre, entraron, nombreAsistente, quienInicio, varianteDeEstado, type Asistente } from "./formato";

interface DatosBloque extends DatosEstadoReunion {
  idReunion: number;
  enlace: string | null;
  asistentes: Asistente[];
}

function minuscula(texto: string) {
  return texto.charAt(0).toLocaleLowerCase("es-PE") + texto.slice(1);
}

/** Hora en que terminó: la finalización real o, si la sala se cerró sola, su cierre. */
export function momentoDeTermino(r: DatosEstadoReunion): Date {
  return r.finalizadaEn ?? (r.videollamada ? ventanaSala(r.inicio, r.fin).cierre : r.fin);
}

/**
 * Bloque principal del detalle según el estado (programada, sala abierta, en curso o por cerrar,
 * terminada). El botón Unirse va a la derecha en escritorio y debajo del contenido en tablet; en
 * móvil lo da la barra de acción fija.
 */
export function BloqueEstadoReunion({
  reunion,
  estado,
  ahora,
  puedeUnirse,
  finalizadoPor,
}: {
  reunion: DatosBloque;
  estado: EstadoLogico;
  ahora: Date;
  /** Líder o miembro (no observador). */
  puedeUnirse: boolean;
  finalizadoPor: string | null;
}) {
  const terminada = estado === "terminada";
  const activo = salaAbierta(estado);
  const etiqueta = varianteDeEstado(estado, reunion, ahora);
  const iniciador = quienInicio(reunion.asistentes);
  const entradas = entraron(reunion.asistentes);
  const { apertura } = ventanaSala(reunion.inicio, reunion.fin);

  let contenido: React.ReactNode;
  if (terminada) {
    const termino = momentoDeTermino(reunion);
    const detalle =
      reunion.videollamada && reunion.iniciadaEn
        ? `${duracionEntre(reunion.iniciadaEn, termino)} · ${finalizadoPor ? `finalizada por ${finalizadoPor}` : "cerrada automáticamente"}`
        : null;
    contenido = (
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="text-lg font-semibold">Terminó {hora(termino)}</span>
        {detalle ? <span className="text-sm text-muted-foreground">{detalle}</span> : null}
      </p>
    );
  } else if (estado === "programada") {
    const faltan = minutosHasta(reunion.inicio, ahora);
    contenido = (
      <>
        <p className="text-lg font-semibold">
          {faltan < 60 ? `Empieza en ${faltan} min` : `Empieza ${minuscula(fechaCorta(reunion.inicio, { ahora }))}, ${hora(reunion.inicio)}`}
        </p>
        {reunion.videollamada ? <p className="mt-1 text-[13px] text-muted-foreground">Sala disponible desde {hora(apertura)}</p> : null}
      </>
    );
  } else if (estado === "sala_abierta") {
    contenido = (
      <>
        <EstadoReunion estado="sala_abierta" tamano="lg" />
        <p className="mt-1.5 text-lg font-semibold">
          {reunion.inicio > ahora ? `Empieza en ${minutosHasta(reunion.inicio, ahora)} min` : `Hasta ${hora(reunion.fin)}`}
        </p>
      </>
    );
  } else {
    contenido = (
      <>
        <EstadoReunion {...etiqueta} tamano="lg" />
        <p className="mt-1.5 text-lg font-semibold">
          {iniciador && reunion.iniciadaEn ? `Iniciada por ${nombreAsistente(iniciador)} · ${hora(reunion.iniciadaEn)}` : `Hasta ${hora(reunion.fin)}`}
        </p>
        {entradas.length > 0 ? (
          <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
            Entraron
            <AvataresApilados personas={entradas.map((a) => ({ idUsuario: a.idUsuario, ...a.usuario }))} tamano={22} anillo="ring-background" />
          </p>
        ) : null}
      </>
    );
  }

  const botonUnirse =
    puedeUnirse && reunion.videollamada && !terminada ? (
      <>
        <BotonUnirse idReunion={reunion.idReunion} tamano="l" deshabilitado={!activo} className="hidden lg:block" />
        <BotonUnirse idReunion={reunion.idReunion} tamano="tactil" deshabilitado={!activo} anchoCompleto className="hidden md:block lg:hidden" />
      </>
    ) : null;

  const enlaceManual =
    !reunion.videollamada && reunion.enlace && !terminada ? (
      <a href={reunion.enlace} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "h-10 max-md:h-11 max-md:w-full md:max-lg:h-11 md:max-lg:w-full")}>
        <ExternalLink aria-hidden />
        Abrir enlace
      </a>
    ) : null;

  return (
    <section
      aria-label="Estado"
      className={cn(
        "flex flex-col gap-3 rounded-[14px] border p-4 lg:flex-row lg:items-center lg:gap-4 lg:p-5",
        activo ? "border-cat-reunion/30 bg-cat-reunion/5" : "bg-muted",
      )}
    >
      <div className="min-w-0 flex-1">{contenido}</div>
      {botonUnirse}
      {puedeUnirse ? enlaceManual : null}
    </section>
  );
}
