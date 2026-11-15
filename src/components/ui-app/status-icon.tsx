import { cn } from "@/lib/utils";
import { ETIQUETA_ESTADO_TAREA, type EstadoTarea } from "@/lib/estado-tarea";

const COLOR: Record<EstadoTarea, string> = {
  pendiente: "text-estado-pendiente",
  en_progreso: "text-estado-en-progreso",
  en_revision: "text-estado-en-revision",
  completada: "text-estado-completada",
  descartada: "text-subtle-foreground",
};

/** Estado de la tarea por forma (vacio, medio, 3/4, check), no solo por color. */
export function StatusIcon({ estado, className, conTexto = false }: { estado: EstadoTarea; className?: string; conTexto?: boolean }) {
  const icono = (
    <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0", COLOR[estado], !conTexto && className)} role="img" aria-label={conTexto ? undefined : ETIQUETA_ESTADO_TAREA[estado]} aria-hidden={conTexto || undefined}>
      {estado === "completada" ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M5 8.2l2 2 4-4.2" fill="none" stroke="var(--background)" strokeWidth="1.6" />
        </>
      ) : estado === "descartada" ? (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
          <path d="M5.5 10.5l5-5" stroke="currentColor" strokeWidth="1.5" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {estado === "en_progreso" ? <path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor" /> : null}
          {estado === "en_revision" ? <path d="M8 4a4 4 0 1 1-4 4h4z" fill="currentColor" /> : null}
        </>
      )}
    </svg>
  );
  if (!conTexto) return icono;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {icono}
      {ETIQUETA_ESTADO_TAREA[estado]}
    </span>
  );
}
