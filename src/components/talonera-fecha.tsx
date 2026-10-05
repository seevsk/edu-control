import { DIAS_CORTOS, diaSemanaISO, diasHasta, etiquetaRelativa, fechaEnZonaLimaISO } from "@/lib/calendario";
import { formatearFechaLima } from "@/lib/dates";

/**
 * Talon de fecha limite al costado de una tarjeta: el dia grande y cuanto falta. El color
 * codifica urgencia (no decora): coral si es hoy, manana o ya paso; ambar hasta 3 dias.
 */
export function TaloneraFecha({ fecha }: { fecha: Date | null }) {
  if (!fecha) {
    return (
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-sm bg-bg px-1 py-2 text-center">
        <span className="text-[11px] leading-tight text-text-muted">Sin fecha</span>
      </div>
    );
  }

  const ahora = new Date();
  const dias = diasHasta(fecha, ahora);
  const fechaISO = fechaEnZonaLimaISO(fecha);
  const tono = dias <= 1 ? "text-danger" : dias <= 3 ? "text-estado-revision" : "text-text";

  return (
    <div
      className="flex w-14 shrink-0 flex-col items-center justify-center rounded-sm bg-bg px-1 py-2 text-center"
      title={`Finaliza el ${formatearFechaLima(fecha)}`}
    >
      <span className="text-[10px] leading-none text-text-muted">Finaliza</span>
      <span className={`mt-1 text-2xl font-semibold leading-none tabular-nums ${tono}`}>{Number(fechaISO.slice(8))}</span>
      <span className="mt-0.5 text-[11px] leading-none text-text-muted">{DIAS_CORTOS[diaSemanaISO(fechaISO) - 1].toLowerCase()}</span>
      <span className={`mt-1.5 text-[10px] font-medium leading-tight ${tono}`}>{etiquetaRelativa(fecha, ahora)}</span>
    </div>
  );
}
