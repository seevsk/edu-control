"use client";

import Link from "next/link";
import { Check, ExternalLink, Eye, Video, X } from "lucide-react";
import { estadoReunion, salaAbierta } from "@/lib/estado-reunion";
import { fechaCompleta, fechaCorta, hora } from "@/lib/formato-fecha";
import { DIAS_CORTOS, diaSemanaISO, fechaEnZonaLimaISO } from "@/lib/calendario";
import { aOracion } from "@/lib/presentacion";
import { cn } from "@/lib/utils";
import { CourseDot } from "@/components/ui-app/course-dot";
import { buttonVariants } from "@/components/ui/button";
import { AvataresApilados } from "./avatares-apilados";
import { BotonUnirse } from "./boton-unirse";
import { EstadoReunion } from "./estado-reunion";
import {
  conteoAsistencia,
  entraron,
  lineaIniciada,
  nombreAsistente,
  quienInicio,
  rangoReunion,
  varianteDeEstado,
  type Asistente,
  type Respuesta,
} from "./formato";
import { useAhora } from "./reloj";
import { SelectorAsistencia } from "./selector-asistencia";

export interface ReunionFila {
  idReunion: number;
  idGrupo: number;
  titulo: string;
  inicio: Date;
  fin: Date;
  lugar: string | null;
  enlace: string | null;
  videollamada: boolean;
  iniciadaEn: Date | null;
  finalizadaEn: Date | null;
  grupo: { nombre: string };
  asistentes: Asistente[];
}

function dominio(enlace: string): string {
  try {
    return new URL(enlace).hostname.replace(/^www\./, "");
  } catch {
    return "Enlace";
  }
}

function personas(lista: Asistente[]) {
  return lista.map((a) => ({ idUsuario: a.idUsuario, ...a.usuario }));
}

/**
 * Fila de reunión. `grupo`: dentro de un grupo (columna de fecha). `modulo`: en /reuniones (bloque de
 * fecha y nombre del grupo). La fila entera enlaza al detalle; los botones quedan por encima del enlace.
 */
export function FilaReunion({
  reunion,
  variante,
  ahoraInicial,
  puedeUnirse,
  observador = false,
  miRespuesta = "pendiente",
  idCurso = null,
  destacada = false,
}: {
  reunion: ReunionFila;
  variante: "grupo" | "modulo";
  ahoraInicial: string;
  /** Líder o miembro: ve Unirse. Los observadores no. */
  puedeUnirse: boolean;
  observador?: boolean;
  miRespuesta?: Respuesta;
  idCurso?: number | null;
  /** Fila de la sección "En curso". */
  destacada?: boolean;
}) {
  const ahora = useAhora(ahoraInicial);
  const estado = estadoReunion(reunion, ahora);
  const terminada = estado === "terminada";
  const abierta = salaAbierta(estado);
  const esVideo = reunion.videollamada;
  const enCurso = !terminada && (destacada || (abierta && reunion.iniciadaEn !== null));
  const etiqueta = varianteDeEstado(estado, reunion, ahora);
  const entradas = entraron(reunion.asistentes);
  const iniciador = quienInicio(reunion.asistentes);
  const gente = terminada && esVideo ? entradas : reunion.asistentes.filter((a) => a.respuesta === "asistire");
  const conteo = conteoAsistencia(reunion, terminada);
  const puedeResponder = puedeUnirse && !terminada && !reunion.iniciadaEn;
  const unirseVisible = puedeUnirse && esVideo && !terminada && (variante === "modulo" || abierta);
  const fechaISO = fechaEnZonaLimaISO(reunion.inicio);
  const lugarVisible = esVideo || !reunion.enlace ? reunion.lugar : null;
  const linea2 = [rangoReunion(reunion), esVideo ? "Videollamada" : reunion.enlace ? `Virtual · ${dominio(reunion.enlace)}` : null, lugarVisible]
    .filter(Boolean)
    .join(" · ");

  const titulo = (
    <Link
      href={`/reuniones/${reunion.idReunion}`}
      className="truncate font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring/60"
    >
      {reunion.titulo}
    </Link>
  );
  const iconoVideo = esVideo ? <Video className="size-3.5 shrink-0 text-cat-reunion" aria-label="Videollamada en EduControl" /> : null;

  // Etiqueta de estado junto al horario (módulo).
  const estadoInline = enCurso ? (
    <EstadoReunion estado="en_curso" />
  ) : esVideo && !terminada ? (
    <EstadoReunion {...etiqueta} />
  ) : null;

  const respuestaMovil =
    miRespuesta === "asistire" ? (
      <span className="inline-flex items-center gap-1 text-estado-completada">
        <Check className="size-3.5" aria-hidden />
        Asistirás
      </span>
    ) : miRespuesta === "no_asistire" ? (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <X className="size-3.5" aria-hidden />
        No asistirás
      </span>
    ) : (
      <span className="text-muted-foreground">Sin responder</span>
    );

  const nombreIniciador = iniciador ? nombreAsistente(iniciador) : null;
  const desdeInicio = iniciador?.fechaEntrada ?? reunion.iniciadaEn;
  // Sección "En curso": en el grupo es una fila destacada (móvil: tarjeta con Unirse a todo el ancho).
  // En el módulo la tarjeta solo existe en móvil; desde md se usa la fila con bloque de fecha.
  const modulo = variante === "modulo";
  const tarjetaEnCurso = enCurso ? (
    <li className={cn("relative border-b border-cat-reunion/20 bg-cat-reunion-bg", modulo && "md:hidden")}>
      <div className={cn("flex flex-col gap-2.5 px-4 pt-3.5 pb-4", !modulo && "md:flex-row md:items-center md:gap-3.5 md:px-5 md:py-4 lg:px-6 lg:py-3.5")}>
        <div className="min-w-0 flex-1">
          <div className={cn("flex items-center justify-between gap-3", !modulo && "md:justify-start")}>
            <EstadoReunion estado={etiqueta.estado === "por_cerrar" ? "por_cerrar" : "en_curso"} minutos={etiqueta.minutos} />
            <AvataresApilados personas={personas(entradas)} tamano={26} anillo="ring-cat-reunion-bg" className={cn(!modulo && "md:hidden")} />
          </div>
          <p className={cn("mt-2 flex min-w-0 text-[17px]", !modulo && "md:mt-1 md:text-[15px]")}>{titulo}</p>
          {modulo ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
              {idCurso !== null ? <CourseDot idCurso={idCurso} className="size-[7px]" /> : null}
              <span>{aOracion(reunion.grupo.nombre)} ·</span>
              <span>
                {nombreIniciador && desdeInicio ? `${nombreIniciador} · ${hora(desdeInicio)}` : "Sala abierta"} · hasta {hora(reunion.fin)}
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {nombreIniciador && desdeInicio ? (
                <>
                  <span className="md:hidden">{lineaIniciada(nombreIniciador, desdeInicio, ahora, true)}</span>
                  <span className="hidden md:inline">{lineaIniciada(nombreIniciador, desdeInicio, ahora)}</span>
                </>
              ) : (
                "Sala abierta"
              )}{" "}
              · hasta {hora(reunion.fin)}
            </p>
          )}
        </div>
        {!modulo ? <AvataresApilados personas={personas(entradas)} tamano={24} anillo="ring-cat-reunion-bg" className="hidden md:flex" /> : null}
        {puedeUnirse && esVideo ? (
          <div className="relative z-10">
            <BotonUnirse idReunion={reunion.idReunion} tamano="tactil" anchoCompleto className={cn(!modulo && "md:hidden")} />
            {!modulo ? (
              <>
                <BotonUnirse idReunion={reunion.idReunion} tamano="tactil" className="hidden md:block lg:hidden" />
                <BotonUnirse idReunion={reunion.idReunion} tamano="m" className="hidden lg:block" />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  ) : null;
  if (variante === "grupo" && tarjetaEnCurso) return tarjetaEnCurso;



  if (variante === "modulo") {
    const dia = DIAS_CORTOS[diaSemanaISO(fechaISO) - 1];
    const esHoy = fechaCorta(reunion.inicio, { ahora }) === "Hoy";
    const lineaMovil = terminada ? (
      <span className="text-subtle-foreground">{conteo}</span>
    ) : abierta && esVideo ? (
      <EstadoReunion estado="sala_abierta" />
    ) : observador ? (
      <span className="inline-flex items-center gap-1">
        <Eye className="size-3.5" aria-hidden />
        Observador
      </span>
    ) : !esVideo && reunion.enlace ? (
      <a href={reunion.enlace} target="_blank" rel="noopener noreferrer" className="relative z-10 underline-offset-2 hover:underline">
        Abrir enlace
      </a>
    ) : (
      respuestaMovil
    );
    const filaMovil = enCurso ? null : (
      <li className={cn("relative border-b border-border-subtle hover:bg-muted md:hidden", terminada && "opacity-85")}>
        <div className="flex min-h-[68px] items-center gap-3 px-4 py-2">
          <span aria-hidden className="h-10 w-[3px] shrink-0 rounded-full bg-cat-reunion" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[15px]">
              {iconoVideo}
              {titulo}
            </div>
            <p className="mt-[3px] truncate text-[13px] text-subtle-foreground">
              {fechaCorta(reunion.inicio, { ahora })} · {rangoReunion(reunion)}
            </p>
            <p className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
              {idCurso !== null ? <CourseDot idCurso={idCurso} className="size-[7px]" /> : null}
              <span className="truncate">{aOracion(reunion.grupo.nombre)} ·</span>
              {lineaMovil}
            </p>
          </div>
          {unirseVisible && abierta ? (
            <span className="relative z-10">
              <BotonUnirse idReunion={reunion.idReunion} tamano="tactil" />
            </span>
          ) : null}
        </div>
      </li>
    );
    return (
      <>
      {tarjetaEnCurso}
      {filaMovil}
      <li className={cn("relative border-b border-border-subtle max-md:hidden", enCurso ? "bg-cat-reunion-bg" : "hover:bg-muted", terminada && "opacity-85")}>
        <div className="flex min-h-[68px] items-center gap-3 px-4 py-2 md:gap-3.5 md:px-5 lg:px-8">
          <div
            className={cn(
              "grid h-[46px] w-11 shrink-0 place-items-center rounded-[10px] border text-center leading-none",
              enCurso ? "border-cat-reunion/40 bg-cat-reunion-bg text-cat-reunion-fg" : "bg-background",
            )}
            title={fechaCompleta(reunion.inicio)}
          >
            <span className={cn("text-[10px] font-semibold uppercase", !enCurso && "text-subtle-foreground")}>{esHoy ? "Hoy" : dia}</span>
            <span className="text-[17px] font-semibold tabular-nums">{Number(fechaISO.slice(8))}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[15px] md:text-sm">
              {iconoVideo}
              {titulo}
            </div>
            <div className="mt-[3px] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-subtle-foreground">
              {idCurso !== null ? <CourseDot idCurso={idCurso} className="size-[7px]" /> : null}
              <span className="truncate">{aOracion(reunion.grupo.nombre)}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{rangoReunion(reunion)}</span>
              {estadoInline ? (
                <>
                  <span aria-hidden>·</span>
                  {estadoInline}
                </>
              ) : null}
            </div>
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-3.5">
            <AvataresApilados personas={personas(gente)} tamano={22} anillo={enCurso ? "ring-cat-reunion-bg" : "ring-background"} className="hidden md:flex" />
            {terminada ? <span className="hidden text-xs text-muted-foreground md:inline">{conteo}</span> : null}
            {observador && !terminada ? (
              <span className="inline-flex items-center gap-1 text-xs text-subtle-foreground">
                <Eye className="size-3.5" aria-hidden />
                Observador
              </span>
            ) : null}
            {puedeResponder ? <SelectorAsistencia idReunion={reunion.idReunion} valor={miRespuesta} className="hidden md:inline-flex" /> : null}
            {!terminada && puedeUnirse && !esVideo && reunion.enlace ? (
              <a href={reunion.enlace} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "hidden h-[30px] md:inline-flex")}>
                <ExternalLink aria-hidden />
                Abrir enlace
              </a>
            ) : null}
            {unirseVisible ? (
              <>
                <BotonUnirse idReunion={reunion.idReunion} tamano="tactil" deshabilitado={!abierta} className="hidden md:block lg:hidden" />
                <BotonUnirse idReunion={reunion.idReunion} tamano="s" deshabilitado={!abierta} className="hidden lg:block" />
                {abierta ? <BotonUnirse idReunion={reunion.idReunion} tamano="tactil" className="md:hidden" /> : null}
              </>
            ) : null}
          </div>
        </div>
      </li>
      </>
    );
  }

  // Variante grupo: próximas y pasadas.
  return (
    <li className={cn("relative border-b border-border-subtle hover:bg-muted", terminada && "opacity-85")}>
      <div className="flex min-h-[68px] items-center gap-3 px-4 py-2 md:min-h-14 md:px-5 lg:px-6">
        <div className="hidden w-[74px] shrink-0 text-[13px] md:block" title={fechaCompleta(reunion.inicio)}>
          <div>{fechaCorta(reunion.inicio, { ahora })}</div>
          <div className="mt-0.5 text-xs text-subtle-foreground">{hora(reunion.inicio)}</div>
        </div>
        <span aria-hidden className="h-10 w-[3px] shrink-0 rounded-full bg-cat-reunion md:h-[34px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[15px] md:text-sm">
            {iconoVideo}
            {titulo}
          </div>
          <p className="mt-[3px] truncate text-[13px] text-subtle-foreground md:hidden">
            {fechaCorta(reunion.inicio, { ahora })} · {rangoReunion(reunion)}
          </p>
          <p className="mt-[3px] hidden truncate text-xs text-subtle-foreground md:block">{linea2}</p>
          <p className="mt-0.5 flex items-center gap-2 text-[13px] text-muted-foreground md:hidden">
            {abierta && esVideo ? <EstadoReunion estado="sala_abierta" /> : null}
            <AvataresApilados personas={personas(gente)} tamano={20} max={3} />
            <span className="truncate">{conteo}</span>
          </p>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-3.5">
          <span className="hidden items-center gap-3.5 md:flex">
            {abierta && esVideo && !terminada ? <EstadoReunion estado="sala_abierta" /> : null}
            <AvataresApilados personas={personas(gente)} tamano={22} />
            <span className="text-xs text-muted-foreground">{conteo}</span>
          </span>
          {unirseVisible ? (
            <>
              <BotonUnirse idReunion={reunion.idReunion} tamano="tactil" deshabilitado={!abierta} className="hidden md:block lg:hidden" />
              <BotonUnirse idReunion={reunion.idReunion} tamano="s" deshabilitado={!abierta} className="hidden lg:block" />
              {abierta ? <BotonUnirse idReunion={reunion.idReunion} tamano="tactil" className="md:hidden" /> : null}
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
