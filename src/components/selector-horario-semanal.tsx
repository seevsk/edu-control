import { DIAS_CORTOS, DIAS_LARGOS } from "@/lib/calendario";
import { RangoHoras } from "@/components/ui-app/rango-horas";

const OPCION_DIA =
  "flex min-w-12 cursor-pointer select-none items-center justify-center rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm transition-colors duration-150 hover:bg-bg has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-medium has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary";

/** Días (chips) + franja horaria. Envía `dias`/`diaSemana`, `horaInicio`, `horaFin` y, si aplica, `excepcional`. */
export function SelectorHorarioSemanal({
  modo = "multiple",
  incluirDomingo = true,
  diasSeleccionados = [],
  horaInicio = "09:00",
  horaFin = "13:00",
  tituloDias,
  permitirExcepcional = false,
  excepcional = false,
}: {
  modo?: "multiple" | "unico";
  incluirDomingo?: boolean;
  diasSeleccionados?: number[];
  horaInicio?: string;
  horaFin?: string;
  tituloDias?: string;
  /** Solo tiempo ocupado: permite horarios que terminan al día siguiente (p. ej. 9:00pm - 8:00am). */
  permitirExcepcional?: boolean;
  excepcional?: boolean;
}) {
  const dias = incluirDomingo ? DIAS_CORTOS : DIAS_CORTOS.slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="text-sm font-medium">{tituloDias ?? (modo === "multiple" ? "Días" : "Día")}</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dias.map((dia, indice) => (
            <label key={dia} className={OPCION_DIA}>
              <input
                type={modo === "multiple" ? "checkbox" : "radio"}
                name={modo === "multiple" ? "dias" : "diaSemana"}
                value={indice + 1}
                defaultChecked={diasSeleccionados.includes(indice + 1)}
                required={modo === "unico"}
                className="sr-only"
                aria-label={DIAS_LARGOS[indice]}
              />
              {dia}
            </label>
          ))}
        </div>
      </fieldset>

      <RangoHoras horaInicio={horaInicio} horaFin={horaFin} permitirExcepcional={permitirExcepcional} excepcional={excepcional} />
    </div>
  );
}
