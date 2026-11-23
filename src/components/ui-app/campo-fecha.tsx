"use client";

import { useState } from "react";
import { es } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { fechaCorta } from "@/lib/formato-fecha";

/** "2026-11-24" <-> Date local al mediodia (evita saltos de dia por zona horaria). */
function aFecha(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia, 12);
}

function aISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

/** Selector de dia con calendario (semana desde lunes) y atajos; viaja como "AAAA-MM-DD" en un input oculto. */
export function CampoFecha({
  name,
  defaultValue = "",
  placeholder = "Elegir fecha",
  id,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  id?: string;
}) {
  const [valor, setValor] = useState(defaultValue);
  const [abierto, setAbierto] = useState(false);
  const seleccionada = aFecha(valor);
  const hoy = new Date();
  const atajos = [
    { texto: "Hoy", dias: 0 },
    { texto: "Mañana", dias: 1 },
    { texto: "En 1 semana", dias: 7 },
  ];

  function elegir(fecha: Date | undefined) {
    if (!fecha) return;
    setValor(aISO(fecha));
    setAbierto(false);
  }

  return (
    <>
      <input type="hidden" name={name} value={valor} />
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className="w-full justify-start font-normal max-md:h-11">
            <CalendarDays aria-hidden />
            {seleccionada ? fechaCorta(seleccionada) : <span className="text-subtle-foreground">{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex gap-1 border-b p-2">
            {atajos.map((atajo) => (
              <Button key={atajo.texto} type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => elegir(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + atajo.dias, 12))}>
                {atajo.texto}
              </Button>
            ))}
          </div>
          <Calendar mode="single" locale={es} weekStartsOn={1} selected={seleccionada} defaultMonth={seleccionada} onSelect={elegir} />
        </PopoverContent>
      </Popover>
    </>
  );
}
