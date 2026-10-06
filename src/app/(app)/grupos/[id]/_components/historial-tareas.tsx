import Link from "next/link";
import { formatearFechaHoraLima } from "@/lib/dates";
import { describirCambioTarea, type EntradaHistorialTarea } from "@/lib/tarea-historial";

export function HistorialTareas({
  entradas,
  nombres,
  idGrupo,
}: {
  entradas: EntradaHistorialTarea[];
  nombres: ReadonlyMap<number, string>;
  idGrupo: number;
}) {
  if (entradas.length === 0) {
    return <p className="text-sm text-text-muted">Todavía no hay actividad.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {entradas.map((entrada) => (
        <li key={entrada.idHistorial} className="rounded-md border border-border bg-surface p-3 text-sm">
          {entrada.tarea ? (
            <Link
              href={`/grupos/${idGrupo}/tareas/${entrada.tarea.idTarea}`}
              className="mb-1 block font-medium text-primary hover:underline"
            >
              {entrada.tarea.titulo}
            </Link>
          ) : null}
          <p>{describirCambioTarea(entrada, nombres)}</p>
          <p className="mt-1 text-xs text-text-muted">
            {entrada.usuario.nombre} {entrada.usuario.apellidos ?? ""} ·{" "}
            <time dateTime={entrada.fecha.toISOString()}>{formatearFechaHoraLima(entrada.fecha)}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}
