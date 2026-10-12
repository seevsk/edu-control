import Link from "next/link";
import type { Entrega } from "./items";

export function ChipEntrega({ entrega }: { entrega: Entrega }) {
  const esEvaluacion = entrega.tipo === "evaluacion";
  return (
    <Link
      href={entrega.href}
      title={`${entrega.contexto}: ${entrega.titulo} · cierra ${entrega.hora}`}
      className={`block rounded-sm border px-1.5 py-1 text-[11px] leading-snug transition-colors duration-150 ${
        esEvaluacion
          ? "border-danger/25 bg-danger/[0.07] hover:border-danger/50"
          : "border-primary/25 bg-primary-soft hover:border-primary/50"
      }`}
    >
      <span className={`block font-medium tabular-nums ${esEvaluacion ? "text-danger" : "text-primary"}`}>
        {esEvaluacion ? "Evaluación" : "Tarea"} · {entrega.hora}
      </span>
      <span className="line-clamp-2 text-text">{entrega.titulo}</span>
      <span className="block truncate text-text-muted">{entrega.contexto}</span>
    </Link>
  );
}
