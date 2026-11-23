"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { duracionMinutos, formatoHora } from "@/lib/formato-fecha";
import { cn } from "@/lib/utils";

const PASO = 30;
const DIA = 24 * 60;
const DURACIONES = [60, 90, 120, 180];

const aMinutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const aHHMM = (minutos: number) => {
  const normal = ((minutos % DIA) + DIA) % DIA;
  return `${String(Math.floor(normal / 60)).padStart(2, "0")}:${String(normal % 60).padStart(2, "0")}`;
};
const etiqueta = (minutos: number) => formatoHora(Math.floor(minutos / 60) % 24, minutos % 60);

/** Franjas del día para ordenar la lista (de mañana a madrugada, como se piensa un horario). */
const FRANJAS = [
  { titulo: "Mañana", desde: 5 * 60, hasta: 12 * 60 },
  { titulo: "Tarde", desde: 12 * 60, hasta: 19 * 60 },
  { titulo: "Noche", desde: 19 * 60, hasta: DIA },
  { titulo: "Madrugada", desde: 0, hasta: 5 * 60 },
];

/** Valor interno de cada opción ("19:30"): el buscador lo interpreta con `coincide`. */
const claveDe = (minutos: number) => aHHMM(minutos);

/**
 * ¿La hora escrita describe esta opción? Acepta "7", "7p", "7:3", "730pm", "19", "19:30".
 * Sin am/pm, "7" vale para 7:00am y 7:00pm; desde 13 se entiende en 24 h.
 */
function coincide(clave: string, busqueda: string) {
  const texto = busqueda.toLowerCase().replace(/[\s.]/g, "");
  if (!texto) return true;
  const partes = texto.match(/^(\d{1,2})(?::?(\d{0,2}))?(a|am|p|pm)?$/);
  if (!partes) return false;
  const [horas, minutos] = clave.split(":").map(Number);
  const escrita = Number(partes[1]);
  const meridiano = partes[3]?.[0];
  const hora12 = horas % 12 === 0 ? 12 : horas % 12;
  const horaOk = escrita > 12 || escrita === 0 ? escrita === horas : hora12 === escrita;
  const meridianoOk = !meridiano || (meridiano === "a" ? horas < 12 : horas >= 12);
  const minutosOk = !partes[2] || String(minutos).padStart(2, "0").startsWith(partes[2]);
  return horaOk && meridianoOk && minutosOk;
}

function CampoHora({
  etiqueta: titulo,
  valor,
  onCambiar,
  desde,
  permitirDiaSiguiente,
}: {
  etiqueta: string;
  valor: number;
  onCambiar: (minutos: number) => void;
  /** Si se indica, la lista muestra la duración desde esta hora (campo "Hasta"). */
  desde?: number;
  permitirDiaSiguiente?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const opciones = Array.from({ length: DIA / PASO }, (_, indice) => indice * PASO);
  const duracion = (minutos: number) => {
    if (desde === undefined) return null;
    const total = minutos > desde ? minutos - desde : permitirDiaSiguiente && minutos < desde ? DIA - desde + minutos : null;
    return total ? duracionMinutos(total) : null;
  };
  const disponible = (minutos: number) => desde === undefined || minutos > desde || (permitirDiaSiguiente === true && minutos !== desde);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[13px] font-medium">{titulo}</span>
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${titulo}: ${etiqueta(valor)}`}
            className="flex h-9 max-md:h-11 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm tabular-nums shadow-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:border-ring"
          >
            <Clock className="size-3.5 text-subtle-foreground" aria-hidden />
            <span className="flex-1 text-left">{etiqueta(valor)}</span>
            {desde !== undefined && valor <= desde && permitirDiaSiguiente ? <span className="text-xs text-subtle-foreground">+1 día</span> : null}
            <ChevronDown className="size-3.5 text-subtle-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0">
          <Command
            // Abre con la hora elegida resaltada; escribir filtra ("7:30pm", "19:30").
            defaultValue={claveDe(valor)}
            filter={(clave, busqueda) => (coincide(clave, busqueda) ? 1 : 0)}
          >
            <CommandInput placeholder="Ej. 7p, 7:30, 19" />
            <CommandList className="max-h-64">
              <CommandEmpty>Usa intervalos de 30 minutos.</CommandEmpty>
              {FRANJAS.map((franja) => {
                const enFranja = opciones.filter((minutos) => minutos >= franja.desde && minutos < franja.hasta && disponible(minutos));
                if (!enFranja.length) return null;
                return (
                  <CommandGroup key={franja.titulo} heading={franja.titulo}>
                    {enFranja.map((minutos) => {
                      const texto = duracion(minutos);
                      return (
                        <CommandItem
                          key={minutos}
                          value={claveDe(minutos)}
                          onSelect={() => {
                            onCambiar(minutos);
                            setAbierto(false);
                          }}
                          className="tabular-nums"
                        >
                          <Check className={cn("size-3.5", minutos === valor ? "opacity-100" : "opacity-0")} aria-hidden />
                          <span className="flex-1">{etiqueta(minutos)}</span>
                          {texto ? <span className="text-xs text-subtle-foreground">{desde !== undefined && minutos <= desde ? `+1 día · ${texto}` : texto}</span> : null}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Rango "Desde → Hasta" para horarios semanales. Envía `horaInicio`, `horaFin` (HH:mm) y, si se
 * permite, `excepcional` (el bloque termina al día siguiente), igual que los <select> anteriores.
 * Al mover el inicio se conserva la duración, como en un calendario.
 */
export function RangoHoras({
  horaInicio,
  horaFin,
  permitirExcepcional = false,
  excepcional: excepcionalInicial = false,
}: {
  horaInicio: string;
  horaFin: string;
  permitirExcepcional?: boolean;
  excepcional?: boolean;
}) {
  const [inicio, setInicio] = useState(aMinutos(horaInicio));
  const [fin, setFin] = useState(aMinutos(horaFin));
  const [excepcional, setExcepcional] = useState(excepcionalInicial);
  const cruza = fin <= inicio;
  const duracion = cruza ? (excepcional && fin !== inicio ? DIA - inicio + fin : 0) : fin - inicio;

  function cambiarInicio(nuevo: number) {
    const conservada = duracion || 60;
    const nuevoFin = nuevo + conservada;
    // Sin horario excepcional el fin no puede pasar de la medianoche: se recorta a 11:30pm.
    setFin(excepcional ? nuevoFin % DIA : Math.min(nuevoFin, DIA - PASO));
    setInicio(nuevo);
  }

  return (
    <div className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="horaInicio" value={aHHMM(inicio)} />
      <input type="hidden" name="horaFin" value={aHHMM(fin)} />
      {permitirExcepcional && excepcional ? <input type="hidden" name="excepcional" value="on" /> : null}

      <div className="flex items-end gap-2">
        <CampoHora etiqueta="Desde" valor={inicio} onCambiar={cambiarInicio} />
        <ArrowRight className="mb-2.5 size-4 shrink-0 text-subtle-foreground" aria-hidden />
        <CampoHora etiqueta="Hasta" valor={fin} onCambiar={setFin} desde={inicio} permitirDiaSiguiente={permitirExcepcional && excepcional} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Duración">
        {DURACIONES.map((minutos) => {
          const cabe = excepcional || inicio + minutos < DIA;
          const activa = duracion === minutos;
          return (
            <button
              key={minutos}
              type="button"
              disabled={!cabe}
              aria-pressed={activa}
              onClick={() => setFin((inicio + minutos) % DIA)}
              className={cn(
                "h-7 max-md:h-11 rounded-full border border-input px-2.5 max-md:px-3.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40",
                activa && "border-foreground bg-foreground text-background hover:text-background",
              )}
            >
              {duracionMinutos(minutos)}
            </button>
          );
        })}
        <span className={cn("ml-auto text-xs tabular-nums", duracion ? "text-subtle-foreground" : "text-destructive")} role={duracion ? undefined : "alert"}>
          {duracion
            ? `${etiqueta(inicio)} - ${etiqueta(fin)}${cruza ? " (día siguiente)" : ""}`
            : permitirExcepcional
              ? "Termina antes de empezar: activa Horario excepcional"
              : "El fin debe ser posterior al inicio"}
        </span>
      </div>

      {permitirExcepcional ? (
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          <span>
            Horario excepcional
            <span className="block text-xs font-normal text-text-muted">Termina al día siguiente, como un turno de noche</span>
          </span>
          <Switch checked={excepcional} onCheckedChange={setExcepcional} />
        </label>
      ) : null}
    </div>
  );
}
