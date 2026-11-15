"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { DIAS_LARGOS } from "@/lib/calendario";
import { rangoHoras } from "@/lib/formato-fecha";
import { cn } from "@/lib/utils";
import { crearBloqueOcupadoAction } from "../actions";
import type { EventoCalendario } from "./eventos";

export type TipoTiempo = "laboral" | "familiar" | "personal";

export interface BorradorTiempo {
  fechaISO: string;
  /** 1 = lunes … 7 = domingo. */
  dia: number;
  inicio: string;
  fin: string;
  tipo: TipoTiempo;
  /** Dónde soltó el puntero: ahí se abre el popover. */
  punto: { x: number; y: number };
}

const TIPOS: { valor: TipoTiempo; texto: string; color: string }[] = [
  { valor: "laboral", texto: "Laboral", color: "var(--cat-laboral)" },
  { valor: "familiar", texto: "Familiar", color: "var(--cat-fam)" },
  { valor: "personal", texto: "Personal", color: "var(--cal-personal)" },
];
const DIAS_CORTOS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

/** Cada 30 min, con minutos siempre visibles ("2:00 pm"), como en la maqueta. */
const HORAS = Array.from({ length: 48 }, (_, indice) => {
  const minutos = indice * 30;
  const horas = Math.floor(minutos / 60);
  const valor = `${String(horas).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
  const texto = `${horas % 12 === 0 ? 12 : horas % 12}:${String(minutos % 60).padStart(2, "0")} ${horas < 12 ? "am" : "pm"}`;
  return { valor, texto, minutos };
});

const aMinutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const partes = (minutos: number) => ({ horas: Math.floor(minutos / 60), minutos: minutos % 60 });

/** Primer choque con una clase o un bloque en los días marcados (solo se avisa, no se impide). */
function buscarChoque(eventos: EventoCalendario[], dias: number[], inicio: number, fin: number) {
  for (const dia of dias) {
    for (const evento of eventos) {
      const ventana = evento.data?.semanal;
      if (ventana && ventana.diaSemana === dia && inicio < ventana.finMin && fin > ventana.inicioMin) {
        return { dia, titulo: evento.title, rango: rangoHoras(partes(ventana.inicioMin), partes(ventana.finMin)) };
      }
    }
  }
  return null;
}

export function NuevoTiempoOcupado({
  borrador,
  eventos,
  onCambiar,
  onCerrar,
  volverA,
}: {
  borrador: BorradorTiempo;
  eventos: EventoCalendario[];
  onCambiar: (cambios: Partial<BorradorTiempo>) => void;
  onCerrar: () => void;
  volverA: string;
}) {
  const [dias, setDias] = useState<number[]>([borrador.dia]);
  const [detalle, setDetalle] = useState("");
  const inicio = aMinutos(borrador.inicio);
  const fin = aMinutos(borrador.fin);
  const choque = fin > inicio ? buscarChoque(eventos, dias, inicio, fin) : null;
  const ancla: CSSProperties = { position: "fixed", left: borrador.punto.x, top: borrador.punto.y, width: 1, height: 1, pointerEvents: "none" };
  const masOpciones = `${volverA}&nuevoBloque=1`;

  const alternarDia = (dia: number) =>
    setDias((actuales) => (actuales.includes(dia) ? actuales.filter((otro) => otro !== dia) : [...actuales, dia].sort()));

  return (
    <Popover open onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
      <PopoverAnchor asChild><div style={ancla} aria-hidden /></PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        collisionPadding={16}
        className="w-[340px] rounded-xl p-0"
        aria-label="Agregar tiempo ocupado"
        onInteractOutside={(evento) => {
          // Arrastrar otra franja en la grilla reemplaza este borrador en vez de cerrarlo a medias.
          if ((evento.target as HTMLElement | null)?.closest("[data-slot=event-calendar-day-column]")) evento.preventDefault();
        }}
      >
        <form action={crearBloqueOcupadoAction}>
          <input type="hidden" name="tipo" value={borrador.tipo} />
          <input type="hidden" name="horaInicio" value={borrador.inicio} />
          <input type="hidden" name="horaFin" value={borrador.fin} />
          <input type="hidden" name="volverA" value={volverA} />
          <input type="hidden" name="origen" value={masOpciones} />
          {dias.map((dia) => <input key={dia} type="hidden" name="dias" value={dia} />)}

          <div className="flex items-center px-4 pt-3.5">
            <span className="flex-1 text-[15px] font-semibold">Tiempo ocupado</span>
            <Button type="button" variant="ghost" size="icon" className="size-[26px] text-muted-foreground" aria-label="Cerrar" onClick={onCerrar}><X aria-hidden /></Button>
          </div>

          <div className="flex flex-col gap-3.5 px-4 py-3">
            <div className="flex gap-1.5" role="group" aria-label="Tipo">
              {TIPOS.map((tipo) => (
                <button
                  key={tipo.valor}
                  type="button"
                  aria-pressed={borrador.tipo === tipo.valor}
                  onClick={() => onCambiar({ tipo: tipo.valor })}
                  className={cn(
                    "inline-flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-md border border-input text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                    borrador.tipo === tipo.valor && "border-muted-foreground bg-secondary text-foreground",
                  )}
                >
                  <span className="size-[7px] rounded-[2px]" style={{ background: tipo.color }} aria-hidden />
                  {tipo.texto}
                </button>
              ))}
            </div>

            <div>
              <p className="mb-1.5 text-xs text-subtle-foreground" id="se-repite">Se repite los</p>
              <div className="flex gap-1" role="group" aria-labelledby="se-repite">
                {DIAS_CORTOS.map((corto, indice) => {
                  const dia = indice + 1;
                  const activo = dias.includes(dia);
                  return (
                    <button
                      key={corto}
                      type="button"
                      aria-pressed={activo}
                      aria-label={DIAS_LARGOS[indice]}
                      onClick={() => alternarDia(dia)}
                      className={cn(
                        "h-[30px] w-[34px] rounded-md border border-input text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                        activo && "border-foreground bg-foreground text-background hover:text-background",
                      )}
                    >
                      {corto}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <CampoHora etiqueta="Desde" valor={borrador.inicio} onCambiar={(valor) => onCambiar({ inicio: valor })} />
              <span className="text-subtle-foreground" aria-hidden>→</span>
              <CampoHora etiqueta="Hasta" valor={borrador.fin} onCambiar={(valor) => onCambiar({ fin: valor })} />
            </div>

            <label>
              <span className="sr-only">Detalle</span>
              <Input name="detalle" value={detalle} onChange={(evento) => setDetalle(evento.target.value)} maxLength={120} placeholder="Detalle (solo tú lo ves). Ej. turno en la tienda" className="h-9" />
            </label>

            {fin <= inicio ? (
              <p role="alert" className="text-xs text-destructive">La hora de fin debe ser posterior a la de inicio.</p>
            ) : choque ? (
              <p className="flex items-start gap-2 rounded-lg border border-amber-700/25 bg-amber-700/8 px-2.5 py-2 text-xs text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>
                  El {DIAS_LARGOS[choque.dia - 1].toLowerCase()} choca con {choque.titulo} ({choque.rango}). Puedes guardarlo igual.
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 border-t px-4 py-3">
            <Link href={masOpciones} scroll={false} className="flex-1 text-[13px] text-muted-foreground hover:text-foreground">Más opciones</Link>
            <Button type="button" variant="ghost" size="sm" onClick={onCerrar}>Cancelar</Button>
            <SubmitButton
              disabled={dias.length === 0 || fin <= inicio}
              className="h-8 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Guardar
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function CampoHora({ etiqueta, valor, onCambiar }: { etiqueta: string; valor: string; onCambiar: (valor: string) => void }) {
  return (
    <Select value={valor} onValueChange={onCambiar}>
      <SelectTrigger aria-label={etiqueta} className="h-9 w-full text-sm font-normal">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {HORAS.map((hora) => (
          <SelectItem key={hora.valor} value={hora.valor}>{hora.texto}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
