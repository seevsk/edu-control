import Link from "next/link";
import { OPCIONES_HORA, etiquetaMinutos } from "@/lib/calendario";
import { SubmitButton } from "@/components/submit-button";
import { DIAS_CORTOS, DIAS_LARGOS } from "./items";

type Tipo = "laboral" | "familiar" | "personal";

const TIPOS: { valor: Tipo; label: string; punto: string; marcado: string }[] = [
  {
    valor: "laboral",
    label: "Laboral",
    punto: "bg-cat-laboral",
    marcado: "has-[:checked]:border-cat-laboral has-[:checked]:bg-cat-laboral-bg has-[:checked]:text-cat-laboral-fg",
  },
  {
    valor: "familiar",
    label: "Familiar",
    punto: "bg-cat-fam",
    marcado: "has-[:checked]:border-cat-fam has-[:checked]:bg-cat-fam-bg has-[:checked]:text-cat-fam-fg",
  },
  {
    valor: "personal",
    label: "Personal",
    punto: "bg-cat-fam",
    marcado: "has-[:checked]:border-cat-fam has-[:checked]:bg-cat-fam-bg has-[:checked]:text-cat-fam-fg",
  },
];

const OPCION =
  "flex cursor-pointer select-none items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary";
const OPCION_DIA = `${OPCION} min-w-12 justify-center px-2.5 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-medium has-[:checked]:text-primary`;
const CAMPO = "rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-normal";

/** Si el bloque guardado tiene una hora fuera de los saltos de 30 min, se agrega para no perderla. */
function opcionesCon(...valores: string[]) {
  const opciones = [...OPCIONES_HORA];
  for (const valor of valores) {
    if (opciones.some((opcion) => opcion.valor === valor)) continue;
    const [h, m] = valor.split(":").map(Number);
    opciones.push({ valor, etiqueta: etiquetaMinutos(h * 60 + m) });
  }
  return opciones.sort((a, b) => a.valor.localeCompare(b.valor));
}

export type ValoresBloque = {
  tipo: Tipo;
  dias: number[];
  horaInicio: string;
  horaFin: string;
  detalle: string;
};

export function FormularioBloque({
  action,
  modo,
  valores,
  volverA,
  origen,
}: {
  action: (formData: FormData) => Promise<void>;
  modo: "crear" | "editar";
  valores: ValoresBloque;
  volverA: string;
  origen: string;
}) {
  const opcionesHora = opcionesCon(valores.horaInicio, valores.horaFin);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="volverA" value={volverA} />
      <input type="hidden" name="origen" value={origen} />

      <fieldset>
        <legend className="text-sm font-medium">Tipo</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIPOS.map((tipo) => (
            <label key={tipo.valor} className={`${OPCION} ${tipo.marcado}`}>
              <input
                type="radio"
                name="tipo"
                value={tipo.valor}
                defaultChecked={tipo.valor === valores.tipo}
                required
                className="sr-only"
              />
              <span className={`size-2 rounded-full ${tipo.punto}`} aria-hidden />
              {tipo.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">{modo === "crear" ? "Días" : "Día"}</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DIAS_CORTOS.map((dia, i) => (
            <label key={dia} className={OPCION_DIA}>
              <input
                type={modo === "crear" ? "checkbox" : "radio"}
                name={modo === "crear" ? "dias" : "diaSemana"}
                value={i + 1}
                defaultChecked={valores.dias.includes(i + 1)}
                required={modo === "editar"}
                className="sr-only"
                aria-label={DIAS_LARGOS[i]}
              />
              {dia}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid max-w-md grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Desde
          <select name="horaInicio" defaultValue={valores.horaInicio} required className={`${CAMPO} tabular-nums`}>
            {opcionesHora.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Hasta
          <select name="horaFin" defaultValue={valores.horaFin} required className={`${CAMPO} tabular-nums`}>
            {opcionesHora.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex max-w-md flex-col gap-1 text-sm font-medium">
        <span>
          Detalle <span className="font-normal text-text-muted">(opcional)</span>
        </span>
        <input
          name="detalle"
          maxLength={120}
          defaultValue={valores.detalle}
          placeholder="Ej. Turno en la tienda"
          className={`${CAMPO} placeholder:text-text-muted`}
        />
      </label>

      <div className="flex items-center gap-2 border-t border-border pt-5">
        <SubmitButton className="justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
          {modo === "crear" ? "Agregar bloque" : "Guardar cambios"}
        </SubmitButton>
        <Link
          href={volverA}
          className="rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-medium transition-colors duration-150 hover:bg-bg"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
