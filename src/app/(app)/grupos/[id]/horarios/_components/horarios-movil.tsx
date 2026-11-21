"use client";

import { useState } from "react";
import Link from "next/link";
import { formatoHora } from "@/lib/formato-fecha";
import { cn } from "@/lib/utils";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
/** Celdas del mini-mapa de cada día (resumen de las franjas de 30 min). */
const CELDAS = 8;

interface DiaMovil {
  fechaISO: string;
  corto: string;
  numero: number;
  /** Por franja: quiénes están ocupados. */
  ocupados: number[][];
}

const hora = (minutos: number) => formatoHora(Math.floor(minutos / 60), minutos % 60);
const hhmm = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
const mismos = (a: number[], b: number[]) => a.length === b.length && a.every((id) => b.includes(id));

function tono(faltan: number) {
  if (faltan === 0) return "bg-estado-completada/55";
  if (faltan === 1) return "bg-estado-completada/16";
  return "bg-secondary";
}

/**
 * Horarios del grupo en móvil (Claude Design, "Móvil · Horarios"): franja de la semana con un
 * mini-mapa por día y, debajo, los tramos del día elegido. Nunca muestra el motivo, solo quién falta.
 */
export function HorariosMovil({
  dias,
  franjas,
  personas,
  idGrupo,
  puedeProgramar,
  hoyISO,
}: {
  dias: DiaMovil[];
  franjas: { inicioMin: number; finMin: number }[];
  personas: { idUsuario: number; corto: string }[];
  idGrupo: number;
  puedeProgramar: boolean;
  hoyISO: string;
}) {
  const inicial = Math.max(0, dias.findIndex((dia) => dia.fechaISO === hoyISO));
  const [elegido, setElegido] = useState(inicial);
  const nombres = new Map(personas.map((persona) => [persona.idUsuario, persona.corto]));
  const dia = dias[elegido];
  const [, mes, numero] = dia.fechaISO.split("-").map(Number);

  // Tramos consecutivos con las mismas personas ocupadas.
  const tramos: { inicioMin: number; finMin: number; faltan: number[] }[] = [];
  dia.ocupados.forEach((ocupados, indice) => {
    const ultimo = tramos.at(-1);
    if (ultimo && mismos(ultimo.faltan, ocupados)) ultimo.finMin = franjas[indice].finMin;
    else tramos.push({ inicioMin: franjas[indice].inicioMin, finMin: franjas[indice].finMin, faltan: [...ocupados] });
  });

  return (
    <div className="flex flex-col">
      <div role="group" aria-label="Días de la semana" className="grid grid-cols-7 gap-1">
        {dias.map((otro, indice) => {
          const porCelda = Math.ceil(otro.ocupados.length / CELDAS);
          return (
            <button
              key={otro.fechaISO}
              type="button"
              onClick={() => setElegido(indice)}
              aria-pressed={elegido === indice}
              aria-label={`${otro.corto} ${otro.numero}`}
              className={cn("flex flex-col items-center gap-1.5 rounded-xl pt-2 pb-2.5 focus-visible:outline-2 focus-visible:outline-ring", elegido === indice && "bg-secondary")}
            >
              <span className="text-xs text-subtle-foreground">{otro.corto}</span>
              <span className={cn("text-[15px] tabular-nums", otro.fechaISO === hoyISO && "font-semibold")}>{otro.numero}</span>
              <span className="flex w-5 flex-col gap-[2px]" aria-hidden>
                {Array.from({ length: CELDAS }, (_, celda) => {
                  const grupo = otro.ocupados.slice(celda * porCelda, (celda + 1) * porCelda);
                  const peor = grupo.reduce((maximo, ocupados) => Math.max(maximo, ocupados.length), 0);
                  return <span key={celda} className={cn("h-1.5 rounded-[2px]", grupo.length ? tono(peor) : "bg-transparent")} />;
                })}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-[2px]", tono(0))} aria-hidden />Todos libres</span>
        <span className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-[2px]", tono(1))} aria-hidden />Falta 1</span>
      </div>

      <h3 className="mt-5 mb-2 text-[13px] font-semibold text-muted-foreground">{dia.corto} {numero} {MESES[mes - 1]}</h3>
      <ul className="border-t border-border-subtle">
        {tramos.map((tramo) => {
          const todos = tramo.faltan.length === 0;
          const quienes = tramo.faltan.map((idUsuario) => nombres.get(idUsuario) ?? "Alguien");
          const pasado = dia.fechaISO < hoyISO;
          const fin = Math.min(tramo.inicioMin + 60, tramo.finMin);
          return (
            <li key={tramo.inicioMin} className="flex min-h-[60px] items-center gap-3.5 border-b border-border-subtle py-2.5">
              <span className="w-[68px] shrink-0 text-[13px] leading-5 text-muted-foreground tabular-nums">
                {hora(tramo.inicioMin)}
                <br />
                <span className="text-subtle-foreground">{hora(tramo.finMin)}</span>
              </span>
              <span className={cn("w-[3px] shrink-0 self-stretch rounded-full", todos ? "bg-estado-completada" : tramo.faltan.length === 1 ? "bg-estado-completada/40" : "bg-input")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[15px]", todos && "text-estado-completada")}>
                  {todos ? "Todos libres" : `Falta${quienes.length > 1 ? "n" : ""} ${quienes.length}`}
                </span>
                {quienes.length ? <span className="mt-0.5 block truncate text-[13px] text-subtle-foreground">{quienes.join(", ")}</span> : null}
              </span>
              {todos && puedeProgramar && !pasado && tramo.finMin - tramo.inicioMin >= 60 ? (
                <Link
                  href={`/grupos/${idGrupo}/reuniones?programar=1&fecha=${dia.fechaISO}&inicio=${hhmm(tramo.inicioMin)}&fin=${hhmm(fin)}`}
                  className="flex h-9 shrink-0 items-center rounded-full border border-input px-3.5 text-sm"
                >
                  Programar
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
