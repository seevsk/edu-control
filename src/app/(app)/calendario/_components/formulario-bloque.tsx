import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { SelectorHorarioSemanal } from "@/components/selector-horario-semanal";

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
const CAMPO = "rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-normal";

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

      <SelectorHorarioSemanal
        modo={modo === "crear" ? "multiple" : "unico"}
        diasSeleccionados={valores.dias}
        horaInicio={valores.horaInicio}
        horaFin={valores.horaFin}
      />

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
          {modo === "crear" ? "Agregar tiempo ocupado" : "Guardar cambios"}
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
