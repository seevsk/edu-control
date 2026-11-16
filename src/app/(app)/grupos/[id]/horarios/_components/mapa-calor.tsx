"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { cn } from "@/lib/utils";

export interface PersonaMapa {
  idUsuario: number;
  nombre: string;
  apellidos: string | null;
  fotoUrl: string | null;
  corto: string;
}

export interface DiaMapa {
  corto: string;
  numero: number;
  /** Ids ocupados por franja de 30 min (mismo orden que `horas`). */
  ocupados: number[][];
}

const PASO_ETIQUETA = 4; // una etiqueta cada 2 h (4 franjas de 30 min)

function nivel(ocupados: number, total: number) {
  if (ocupados === 0) return "bg-estado-completada/50 dark:bg-estado-completada/55";
  if (ocupados === 1 && total > 1) return "bg-estado-completada/10 dark:bg-estado-completada/16";
  return "bg-secondary";
}

/**
 * Mapa de calor de la semana: verde fuerte = todos libres. Cada celda es enfocable (flechas para
 * moverse) y muestra quien esta libre y quien ocupado, nunca el motivo de la ocupacion.
 */
/** `horas`: rango de cada franja; `marcas`: etiqueta del eje (con sufijo am/pm) de cada franja. */
export function MapaCalor({ dias, horas, marcas, personas }: { dias: DiaMapa[]; horas: string[]; marcas: string[]; personas: PersonaMapa[] }) {
  const [activa, setActiva] = useState<{ dia: number; fila: number } | null>(null);
  const celdas = useRef<(HTMLButtonElement | null)[]>([]);
  const total = personas.length;

  function mover(evento: KeyboardEvent, dia: number, fila: number) {
    const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[evento.key];
    if (!delta) return;
    evento.preventDefault();
    const nuevoDia = Math.min(dias.length - 1, Math.max(0, dia + delta[0]));
    const nuevaFila = Math.min(horas.length - 1, Math.max(0, fila + delta[1]));
    celdas.current[nuevaFila * dias.length + nuevoDia]?.focus();
  }

  const detalle = activa ? (() => {
    const ocupados = new Set(dias[activa.dia].ocupados[activa.fila]);
    return {
      titulo: `${dias[activa.dia].corto} ${dias[activa.dia].numero} · ${horas[activa.fila]}`,
      libres: personas.filter((persona) => !ocupados.has(persona.idUsuario)),
      ocupadas: personas.filter((persona) => ocupados.has(persona.idUsuario)),
    };
  })() : null;

  return (
    <div className="relative" onMouseLeave={() => setActiva(null)}>
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-x-[3px]">
        <div />
        {dias.map((dia) => (
          <div key={`${dia.corto}-${dia.numero}`} className="pb-2 text-center">
            <div className="text-xs text-subtle-foreground">{dia.corto}</div>
            <div className="text-sm font-medium">{dia.numero}</div>
          </div>
        ))}
      </div>
      <div role="grid" aria-label="Disponibilidad del grupo por franja de 30 minutos" className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-x-[3px]">
        {horas.map((hora, fila) => (
          <div key={hora} role="row" className="contents">
            <div className="relative h-[13px]" aria-hidden>
              {fila % PASO_ETIQUETA === 0 ? <span className="absolute -top-[7px] right-2 text-[11px] text-subtle-foreground">{marcas[fila]}</span> : null}
            </div>
            {dias.map((dia, indiceDia) => {
              const ocupados = dia.ocupados[fila].length;
              const libres = total - ocupados;
              return (
                <button
                  key={`${dia.corto}-${fila}`}
                  ref={(nodo) => { celdas.current[fila * dias.length + indiceDia] = nodo; }}
                  type="button"
                  role="gridcell"
                  tabIndex={fila === 0 && indiceDia === 0 ? 0 : -1}
                  aria-label={`${dia.corto} ${dia.numero}, ${hora}: ${libres} de ${total} libres`}
                  onMouseEnter={() => setActiva({ dia: indiceDia, fila })}
                  onFocus={() => setActiva({ dia: indiceDia, fila })}
                  onBlur={() => setActiva(null)}
                  onKeyDown={(evento) => mover(evento, indiceDia, fila)}
                  className={cn("h-[13px] w-full focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring", nivel(ocupados, total), fila % 2 === 0 && "border-t border-background")}
                />
              );
            })}
          </div>
        ))}
      </div>
      {activa && detalle ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 w-[230px] rounded-lg border bg-popover p-3 text-xs shadow-pop"
          style={{
            top: 34 + activa.fila * 13,
            left: activa.dia < 4 ? `calc(52px + (100% - 52px) * ${(activa.dia + 1) / 7} + 6px)` : undefined,
            right: activa.dia >= 4 ? `calc((100% - 52px) * ${(7 - activa.dia) / 7} + 6px)` : undefined,
          }}
        >
          <p className="text-[13px] font-medium">{detalle.titulo}</p>
          {detalle.libres.map((persona) => (
            <p key={persona.idUsuario} className="mt-2 flex items-center gap-1.5 text-muted-foreground"><UserAvatar usuario={persona} tamano="xs" />Libre: {persona.corto}</p>
          ))}
          {detalle.ocupadas.map((persona) => (
            <p key={persona.idUsuario} className="mt-1.5 flex items-center gap-1.5 text-muted-foreground"><UserAvatar usuario={persona} tamano="xs" />Ocupado: {persona.corto}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
