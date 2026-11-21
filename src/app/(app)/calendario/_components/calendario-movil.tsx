"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Search, Video } from "lucide-react";
import { diaSemanaISO, fechaEnZonaLimaISO, minutosDelDiaLima, sumarDiasISO } from "@/lib/calendario";
import { formatoHora } from "@/lib/formato-fecha";
import { ACCION_MOVIL } from "@/components/ui-app/page-header";
import { PuntoEnCurso } from "@/components/ui-app/reuniones/punto-en-curso";
import { cn } from "@/lib/utils";
import type { EventoCalendario } from "./eventos";

const INICIALES = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_AGENDA = 7;

interface Ocurrencia {
  clave: string;
  titulo: string;
  subtitulo: string;
  color: string;
  inicioMin: number | null;
  finMin: number | null;
  /** Termina al día siguiente (horario excepcional). */
  cruza: boolean;
  href: string | null;
  videollamada?: boolean;
  enCurso?: boolean;
}

const hora = (minutos: number) => formatoHora(Math.floor(minutos / 60) % 24, minutos % 60);
const lunesDe = (diaISO: string) => sumarDiasISO(diaISO, 1 - diaSemanaISO(diaISO));
/** La hora ya va en la columna izquierda: se quita del subtítulo ("7:00pm - 8:00pm · Grupo" -> "Grupo"). */
const sinRango = (texto: string) => texto.replace(/^d{1,2}:d{2}[ap]m - d{1,2}:d{2}[ap]m( · )?/, "");

/** Eventos de un día (Lima): patrones semanales proyectados y eventos con fecha. */
function ocurrenciasDel(diaISO: string, eventos: EventoCalendario[]): Ocurrencia[] {
  const lista: Ocurrencia[] = [];
  for (const evento of eventos) {
    const dato = evento.data;
    const href = dato?.acciones.find((accion) => accion.principal)?.href ?? dato?.acciones[0]?.href ?? null;
    const titulo = evento.title.split(" · ")[0];
    if (dato?.semanal) {
      if (dato.semanal.diaSemana !== diaSemanaISO(diaISO)) continue;
      const { inicioMin, finMin } = dato.semanal;
      lista.push({ clave: `${evento.id}-${diaISO}`, titulo, subtitulo: sinRango(dato.subtitulo), color: evento.color ?? "var(--muted-foreground)", inicioMin, finMin, cruza: finMin <= inicioMin, href });
      continue;
    }
    const inicio = new Date(evento.start);
    if (fechaEnZonaLimaISO(inicio) !== diaISO) continue;
    if (evento.allDay) {
      const horaEntrega = evento.title.split(" · ")[1];
      lista.push({ clave: `${evento.id}`, titulo, subtitulo: [horaEntrega ? `Entrega ${horaEntrega}` : "Entrega", dato?.subtitulo].filter(Boolean).join(" · "), color: evento.color ?? "var(--muted-foreground)", inicioMin: null, finMin: null, cruza: false, href });
      continue;
    }
    const inicioMin = minutosDelDiaLima(inicio);
    const finMin = minutosDelDiaLima(new Date(evento.end)) || 1440;
    lista.push({ clave: `${evento.id}`, titulo, subtitulo: sinRango(dato?.subtitulo ?? ""), color: evento.color ?? "var(--muted-foreground)", inicioMin, finMin, cruza: false, href, videollamada: dato?.videollamada, enCurso: dato?.enCurso });
  }
  // Entregas primero (todo el día) y luego por hora de inicio.
  return lista.sort((a, b) => (a.inicioMin ?? -1) - (b.inicioMin ?? -1));
}

function etiquetaDia(diaISO: string, hoyISO: string) {
  const [, mes, dia] = diaISO.split("-").map(Number);
  const base = `${DIAS[diaSemanaISO(diaISO) - 1]} ${dia} ${MESES[mes - 1]}`;
  if (diaISO === hoyISO) return `Hoy · ${base}`;
  if (diaISO === sumarDiasISO(hoyISO, 1)) return `Mañana · ${base}`;
  return base;
}

/**
 * Calendario en móvil (Claude Design, "Móvil · Calendario"): franja de la semana y, debajo, la
 * agenda de 7 días desde el día elegido. Mismos eventos que la vista de escritorio.
 */
export function CalendarioMovil({
  eventos,
  fecha,
  hoyISO,
  hrefAgregar,
}: {
  eventos: EventoCalendario[];
  fecha: string;
  hoyISO: string;
  /** Sin enlace (disponibilidad de otra persona) no se ofrece "Agregar". */
  hrefAgregar?: string;
}) {
  const [elegido, setElegido] = useState(fecha);
  const lunes = lunesDe(elegido);
  const semana = Array.from({ length: 7 }, (_, indice) => sumarDiasISO(lunes, indice));
  const agenda = Array.from({ length: DIAS_AGENDA }, (_, indice) => sumarDiasISO(elegido, indice));
  const mes = Number(elegido.slice(5, 7));

  return (
    <div className="flex flex-col">
      <header className="px-4 pt-3">
        <div className="-mx-2 flex h-11 items-center justify-end gap-1">
          <Link href="/usuarios" aria-label="Buscar personas" className={ACCION_MOVIL}><Search aria-hidden /></Link>
          {hrefAgregar ? <Link href={hrefAgregar} scroll={false} aria-label="Agregar tiempo ocupado" className={ACCION_MOVIL}><Plus aria-hidden /></Link> : null}
        </div>
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-[30px] leading-tight font-bold tracking-[-0.03em]">{MESES_LARGOS[mes - 1]}</h1>
          <button type="button" onClick={() => setElegido(hoyISO)} className="h-9 rounded-full border border-input px-3.5 text-sm">Hoy</button>
          <button type="button" aria-label="Semana anterior" onClick={() => setElegido(sumarDiasISO(lunes, -7))} className="-mr-1 flex size-11 items-center justify-center rounded-full hover:bg-secondary"><ChevronLeft className="size-5" aria-hidden /></button>
          <button type="button" aria-label="Semana siguiente" onClick={() => setElegido(sumarDiasISO(lunes, 7))} className="-mr-2 flex size-11 items-center justify-center rounded-full hover:bg-secondary"><ChevronRight className="size-5" aria-hidden /></button>
        </div>
      </header>

      <div role="group" aria-label="Días de la semana" className="grid grid-cols-7 gap-1 border-b px-2 pt-2 pb-3">
        {semana.map((dia, indice) => {
          const activo = dia === elegido;
          const hoy = dia === hoyISO;
          const conEventos = ocurrenciasDel(dia, eventos).length > 0;
          return (
            <button
              key={dia}
              type="button"
              onClick={() => setElegido(dia)}
              aria-pressed={activo}
              aria-label={etiquetaDia(dia, hoyISO)}
              className="flex h-16 flex-col items-center justify-center gap-1.5 rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className={cn("text-xs text-subtle-foreground", hoy && "font-semibold text-foreground")}>{INICIALES[indice]}</span>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-[15px] tabular-nums",
                  activo ? "bg-foreground font-semibold text-background" : hoy ? "font-semibold text-foreground" : "text-foreground",
                )}
              >
                {Number(dia.slice(8))}
              </span>
              <span className={cn("size-1 rounded-full", conEventos && !activo ? "bg-subtle-foreground" : "bg-transparent")} aria-hidden />
            </button>
          );
        })}
      </div>

      {agenda.map((dia) => {
        const ocurrencias = ocurrenciasDel(dia, eventos);
        return (
          <section key={dia} aria-label={etiquetaDia(dia, hoyISO)}>
            <h2 className="px-4 pt-5 pb-2 text-[13px] font-semibold text-muted-foreground">{etiquetaDia(dia, hoyISO)}</h2>
            {ocurrencias.length ? (
              <ul className="border-t border-border-subtle">
                {ocurrencias.map((ocurrencia) => {
                  const contenido = (
                    <>
                      <span className="w-[68px] shrink-0 text-[13px] leading-5 text-muted-foreground tabular-nums">
                        {ocurrencia.inicioMin === null ? (
                          "Todo el día"
                        ) : (
                          <>
                            {hora(ocurrencia.inicioMin)}
                            <br />
                            <span className="text-subtle-foreground">{hora(ocurrencia.finMin ?? 0)}{ocurrencia.cruza ? " +1" : ""}</span>
                          </>
                        )}
                      </span>
                      <span className="w-[3px] shrink-0 self-stretch rounded-full" style={{ backgroundColor: ocurrencia.color }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[15px]">
                          {ocurrencia.videollamada ? <Video className="size-3.5 shrink-0 text-cat-reunion" aria-label="Videollamada en EduControl" /> : null}
                          <span className="truncate">{ocurrencia.titulo}</span>
                          {ocurrencia.enCurso ? <PuntoEnCurso tamano={6} /> : null}
                        </span>
                        {ocurrencia.subtitulo ? <span className="mt-0.5 block truncate text-[13px] text-subtle-foreground">{ocurrencia.subtitulo}</span> : null}
                      </span>
                    </>
                  );
                  return (
                    <li key={ocurrencia.clave}>
                      {ocurrencia.href ? (
                        <Link href={ocurrencia.href} className="flex min-h-[60px] items-center gap-3.5 border-b border-border-subtle px-4 py-3 hover:bg-muted">{contenido}</Link>
                      ) : (
                        <div className="flex min-h-[60px] items-center gap-3.5 border-b border-border-subtle px-4 py-3">{contenido}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-t border-border-subtle px-4 py-3.5 text-sm text-subtle-foreground">Sin clases ni entregas.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
