"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, ChevronLeft, ExternalLink, MapPin, MoreHorizontal, Trash2, Users, Video } from "lucide-react";
import { estadoReunion, salaAbierta, ventanaSala } from "@/lib/estado-reunion";
import { fechaCompleta, fechaCorta, hora } from "@/lib/formato-fecha";
import { aOracion } from "@/lib/presentacion";
import { cn } from "@/lib/utils";
import { cancelarReunionAction } from "@/app/(app)/reuniones/actions";
import { Migas } from "@/components/ui-app/barra-superior";
import { CourseDot } from "@/components/ui-app/course-dot";
import { PaginaCompleta } from "@/components/ui-app/page-header";
import { BloqueEstadoReunion } from "@/components/ui-app/reuniones/bloque-estado-reunion";
import { BotonUnirse } from "@/components/ui-app/reuniones/boton-unirse";
import { DialogoConfirmarReunion } from "@/components/ui-app/reuniones/dialogo-confirmar-reunion";
import { entraron, nombreAsistente, rangoReunion, type Asistente } from "@/components/ui-app/reuniones/formato";
import { ListaPersonas, type PersonaLista } from "@/components/ui-app/reuniones/lista-personas";
import { useAhora } from "@/components/ui-app/reuniones/reloj";
import { SelectorAsistencia } from "@/components/ui-app/reuniones/selector-asistencia";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface DatosDetalle {
  ahoraInicial: string;
  idUsuario: number;
  reunion: {
    idReunion: number;
    titulo: string;
    inicio: Date;
    fin: Date;
    lugar: string | null;
    enlace: string | null;
    videollamada: boolean;
    iniciadaEn: Date | null;
    finalizadaEn: Date | null;
    asistentes: Asistente[];
  };
  grupo: { idGrupo: number; nombre: string; idCurso: number | null };
  observador: boolean;
  moderador: boolean;
  /** Quien la programó o el líder (se afina con el estado en vivo). */
  puedeCancelarBase: boolean;
  finalizadoPor: string | null;
}

function persona(a: Asistente, conHora = false): PersonaLista {
  return {
    idUsuario: a.idUsuario,
    ...a.usuario,
    hora: conHora && a.fechaEntrada ? hora(a.fechaEntrada) : undefined,
  };
}

function Titulo({ texto, cantidad }: { texto: string; cantidad: number }) {
  return (
    <h3 className="mb-1.5 text-[13px] font-semibold text-muted-foreground">
      {texto} <span className="font-normal text-subtle-foreground">{cantidad}</span>
    </h3>
  );
}

function Columna({ titulo, cantidad, children }: { titulo: string; cantidad: number; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs text-subtle-foreground">
        {titulo} · {cantidad}
      </h4>
      {children}
    </div>
  );
}

function MenuAcciones({
  puedeCancelar,
  alCancelar,
  className,
}: {
  puedeCancelar: boolean;
  alCancelar: () => void;
  className?: string;
}) {
  if (!puedeCancelar) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Más acciones" className={cn("size-8 text-muted-foreground max-md:size-11 max-md:rounded-full", className)}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px] rounded-[10px] max-md:w-[250px] max-md:rounded-[14px] max-md:p-1.5">
        <DropdownMenuItem variant="destructive" onSelect={alCancelar} className="h-[34px] max-md:h-[46px] max-md:text-[15px]">
          <Trash2 aria-hidden />
          Cancelar reunión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Detalle de una reunión (P5). El estado se recalcula en el cliente cada 30 s a partir de las marcas de tiempo. */
export function DetalleReunion({ datos }: { datos: DatosDetalle }) {
  const { reunion, grupo, observador, idUsuario, finalizadoPor } = datos;
  const ahora = useAhora(datos.ahoraInicial);
  const [dialogo, setDialogo] = useState<"cancelar" | null>(null);

  const estado = estadoReunion(reunion, ahora);
  const terminada = estado === "terminada";
  const activo = salaAbierta(estado);
  const puedeUnirse = !observador;
  const puedeCancelar = datos.puedeCancelarBase && !reunion.iniciadaEn && (estado === "programada" || estado === "sala_abierta");
  const puedeResponder = !observador && !reunion.iniciadaEn && !terminada;
  const { apertura } = ventanaSala(reunion.inicio, reunion.fin);

  const mia = reunion.asistentes.find((a) => a.idUsuario === idUsuario)?.respuesta ?? "pendiente";
  const confirmaron = reunion.asistentes.filter((a) => a.respuesta === "asistire");
  const noAsisten = reunion.asistentes.filter((a) => a.respuesta === "no_asistire");
  const sinResponder = reunion.asistentes.filter((a) => a.respuesta === "pendiente");
  const entradas = entraron(reunion.asistentes);
  const nombres = (lista: Asistente[]) => lista.map((a) => (a.idUsuario === idUsuario ? "tú" : nombreAsistente(a))).join(", ");

  const lineaNoAsisten = noAsisten.length > 0 ? <p className="text-[13px] text-muted-foreground">No asistirán: {nombres(noAsisten)}</p> : null;

  let asistencia: React.ReactNode;
  if (terminada) {
    asistencia = (
      <>
        <div className="grid gap-2 md:grid-cols-2 md:gap-8">
          <div>
            <Titulo texto="Confirmaron" cantidad={confirmaron.length} />
            <ListaPersonas personas={confirmaron.map((a) => persona(a))} idUsuarioActual={idUsuario} />
          </div>
          {reunion.videollamada ? (
            <div>
              <Titulo texto="Entraron" cantidad={entradas.length} />
              <ListaPersonas personas={entradas.map((a) => persona(a, true))} idUsuarioActual={idUsuario} />
            </div>
          ) : null}
        </div>
        {lineaNoAsisten}
        {sinResponder.length > 0 ? <p className="text-[13px] text-muted-foreground">Sin responder: {sinResponder.length}</p> : null}
      </>
    );
  } else if (reunion.iniciadaEn) {
    asistencia = (
      <div>
        <Titulo texto="Entraron" cantidad={entradas.length} />
        <ListaPersonas personas={entradas.map((a) => persona(a, true))} idUsuarioActual={idUsuario} />
      </div>
    );
  } else {
    asistencia = (
      <>
        <div className="flex flex-wrap items-center gap-3 max-md:flex-col max-md:items-stretch">
          <h3 className="text-[13px] font-semibold text-muted-foreground">Asistencia</h3>
          {puedeResponder ? <SelectorAsistencia idReunion={reunion.idReunion} valor={mia} grande /> : null}
        </div>
        {confirmaron.length > 0 || sinResponder.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2 md:gap-8">
            {confirmaron.length > 0 ? (
              <Columna titulo="Asistirán" cantidad={confirmaron.length}>
                <ListaPersonas personas={confirmaron.map((a) => persona(a))} idUsuarioActual={idUsuario} />
              </Columna>
            ) : null}
            {sinResponder.length > 0 ? (
              <Columna titulo="Sin responder" cantidad={sinResponder.length}>
                <ListaPersonas personas={sinResponder.map((a) => persona(a))} idUsuarioActual={idUsuario} />
              </Columna>
            ) : null}
          </div>
        ) : null}
        {lineaNoAsisten}
      </>
    );
  }

  const barraMovil = !observador && reunion.videollamada && !terminada;

  return (
    <PaginaCompleta>
      <Migas items={[{ href: "/reuniones", texto: "Reuniones" }, { href: `/grupos/${grupo.idGrupo}`, texto: aOracion(grupo.nombre) }, { texto: reunion.titulo }]} />
      <div className={cn("mx-auto flex w-full flex-col gap-4 px-4 pt-1.5 pb-12 md:max-w-[600px] md:gap-5 md:p-7 lg:max-w-[760px] lg:gap-[22px] lg:p-8", barraMovil && "max-md:pb-44")}>
        <div className="-mx-2 order-0 flex h-11 items-center md:hidden">
          <Link href="/reuniones" className="flex h-11 items-center gap-0.5 pr-2 text-[15px] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-6" aria-hidden />
            Reuniones
          </Link>
          <span className="flex-1" />
          <MenuAcciones puedeCancelar={puedeCancelar} alCancelar={() => setDialogo("cancelar")} />
        </div>

        <div className="order-1 flex items-start justify-between gap-3">
          <h1 className="min-w-0 text-[30px] leading-tight font-bold tracking-[-0.03em] text-balance md:text-[30px] lg:text-2xl lg:tracking-[-0.02em]">{reunion.titulo}</h1>
          <MenuAcciones puedeCancelar={puedeCancelar} alCancelar={() => setDialogo("cancelar")} className="max-md:hidden" />
        </div>

        <ul className="order-2 flex flex-col gap-0.5 text-sm text-muted-foreground max-md:order-3 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-subtle-foreground">
          <li className="flex min-h-7 items-center gap-2.5" title={fechaCompleta(reunion.inicio)}>
            <Calendar aria-hidden />
            <span className="tabular-nums">
              {fechaCorta(reunion.inicio, { ahora })} · {rangoReunion(reunion)}
            </span>
          </li>
          <li className="flex min-h-7 items-center gap-2.5">
            <Users aria-hidden />
            <Link href={`/grupos/${grupo.idGrupo}`} className="inline-flex min-w-0 items-center gap-2 text-foreground hover:underline">
              {grupo.idCurso !== null ? <CourseDot idCurso={grupo.idCurso} className="size-2" /> : null}
              <span className="truncate">{aOracion(grupo.nombre)}</span>
            </Link>
          </li>
          {reunion.lugar ? (
            <li className="flex min-h-7 items-center gap-2.5">
              <MapPin aria-hidden />
              <span className="min-w-0">{reunion.lugar}</span>
            </li>
          ) : null}
          {reunion.videollamada ? (
            <li className="flex min-h-7 items-center gap-2.5">
              <Video className="text-cat-reunion!" aria-hidden />
              <span>Videollamada en EduControl</span>
            </li>
          ) : reunion.enlace ? (
            <li className="flex min-h-7 items-center gap-2.5">
              <ExternalLink aria-hidden />
              <a href={reunion.enlace} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
                Abrir enlace
              </a>
            </li>
          ) : null}
        </ul>

        <div className="order-3 max-md:order-2">
          <BloqueEstadoReunion reunion={reunion} estado={estado} ahora={ahora} puedeUnirse={puedeUnirse} finalizadoPor={finalizadoPor} />
        </div>

        <div className="order-4 flex flex-col gap-3">{asistencia}</div>
      </div>

      {barraMovil ? (
        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 border-t bg-background px-4 py-2.5 md:hidden">
          {estado === "programada" ? <p className="text-center text-[13px] text-muted-foreground">La sala abre a las {hora(apertura)}</p> : null}
          <BotonUnirse idReunion={reunion.idReunion} tamano="barra" deshabilitado={!activo} />
        </div>
      ) : null}

      <DialogoConfirmarReunion
        abierto={dialogo === "cancelar"}
        alCambiar={(abierto) => setDialogo(abierto ? "cancelar" : null)}
        titulo="¿Cancelar la reunión?"
        confirmar="Cancelar reunión"
        accion={cancelarReunionAction.bind(null, reunion.idReunion)}
      />
    </PaginaCompleta>
  );
}
