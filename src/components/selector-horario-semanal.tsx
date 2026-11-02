import { DIAS_CORTOS, DIAS_LARGOS, OPCIONES_HORA, etiquetaMinutos } from "@/lib/calendario";

const OPCION_DIA =
  "flex min-w-12 cursor-pointer select-none items-center justify-center rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm transition-colors duration-150 hover:bg-bg has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-medium has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary";
const CAMPO = "rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-normal tabular-nums";

/** Conserva horas antiguas que no caen en los intervalos actuales de 30 minutos. */
function opcionesCon(...valores: string[]) {
  const opciones = [...OPCIONES_HORA];
  for (const valor of valores) {
    if (opciones.some((opcion) => opcion.valor === valor)) continue;
    const [horas, minutos] = valor.split(":").map(Number);
    opciones.push({ valor, etiqueta: etiquetaMinutos(horas * 60 + minutos) });
  }
  return opciones.sort((a, b) => a.valor.localeCompare(b.valor));
}

export function SelectorHorarioSemanal({
  modo = "multiple",
  incluirDomingo = true,
  diasSeleccionados = [],
  horaInicio = "09:00",
  horaFin = "13:00",
  tituloDias,
}: {
  modo?: "multiple" | "unico";
  incluirDomingo?: boolean;
  diasSeleccionados?: number[];
  horaInicio?: string;
  horaFin?: string;
  tituloDias?: string;
}) {
  const opcionesHora = opcionesCon(horaInicio, horaFin);
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

      <div className="grid max-w-md grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Desde
          <select name="horaInicio" defaultValue={horaInicio} required className={CAMPO}>
            {opcionesHora.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Hasta
          <select name="horaFin" defaultValue={horaFin} required className={CAMPO}>
            {opcionesHora.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-text-muted">Posterior a la hora de inicio</span>
        </label>
      </div>
    </div>
  );
}
