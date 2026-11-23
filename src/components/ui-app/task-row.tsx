import Link from "next/link";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETIQUETA_ESTADO_TAREA, type EstadoTarea } from "@/lib/estado-tarea";
import { StatusIcon } from "./status-icon";
import { DueChip, EtiquetaAtraso } from "./due-chip";
import { UserAvatar } from "./user-avatar";

export interface FilaTarea {
  idTarea: number;
  titulo: string;
  estado: EstadoTarea;
  fechaLimite: Date | null;
  asignado: { idUsuario: number; nombre: string; apellidos: string | null; fotoUrl: string | null } | null;
  /** "Te toca revisar" u otra nota corta de accion. */
  nota?: string;
  /** Archivos de la entrega vigente (clip en el tablero y la lista). */
  adjuntos?: number;
  /** Completada después de su fecha límite vigente (calculado en el servidor). */
  conAtraso?: boolean;
  /** Linea secundaria opcional (grupo, curso). */
  detalle?: ReactNode;
}

/** Fila de 40-52px estilo Plane/Linear: icono de estado, titulo, fecha y responsable. */
export function TaskRow({ tarea, href, ahora, alta = false, conAvatar = true }: { tarea: FilaTarea; href: string; ahora: Date; alta?: boolean; conAvatar?: boolean }) {
  const cerrada = tarea.estado === "completada" || tarea.estado === "descartada";
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        className={cn(
          "flex items-center gap-3 border-b border-border-subtle px-4 text-[15px] hover:bg-muted focus-visible:bg-muted sm:px-6 md:text-[13px]",
          // Móvil: filas de 60 px (objetivo táctil holgado); desde md, densas como en escritorio.
          alta ? "min-h-[60px] py-2.5 md:min-h-[52px] md:py-2" : "min-h-[60px] py-2.5 md:min-h-10 md:py-1.5",
          cerrada && "text-muted-foreground",
        )}
      >
        <StatusIcon estado={tarea.estado} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("truncate", tarea.estado === "descartada" && "line-through")}>{tarea.titulo}</span>
          {tarea.detalle ? <span className="flex items-center gap-1.5 truncate text-[13px] text-subtle-foreground md:text-xs">{tarea.detalle}</span> : null}
          {tarea.nota ? <span className="text-[13px] text-estado-en-revision sm:hidden">{tarea.nota}</span> : null}
        </span>
        {tarea.nota ? <span className="hidden shrink-0 text-xs text-estado-en-revision sm:inline">{tarea.nota}</span> : null}
        {tarea.conAtraso ? <EtiquetaAtraso /> : null}
        <DueChip fecha={tarea.fechaLimite} cerrada={cerrada} ahora={ahora} />
        {conAvatar ? <UserAvatar usuario={tarea.asignado} /> : null}
      </Link>
    </li>
  );
}

/** Cabecera de grupo por estado (icono, nombre, contador y "+") con sus filas. */
export function StatusGroup({
  estado,
  cantidad,
  hrefNueva,
  vacio,
  children,
}: {
  estado: EstadoTarea;
  cantidad: number;
  hrefNueva?: string;
  vacio?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={ETIQUETA_ESTADO_TAREA[estado]}>
      <h2 className="flex h-10 items-center gap-2 border-b bg-muted px-4 text-[13px] sm:px-6 md:h-9">
        <StatusIcon estado={estado} />
        <span className="font-medium">{ETIQUETA_ESTADO_TAREA[estado]}</span>
        <span className="text-subtle-foreground">{cantidad}</span>
        {hrefNueva ? (
          <Link
            href={hrefNueva}
            scroll={false}
            aria-label={`Nueva tarea en ${ETIQUETA_ESTADO_TAREA[estado]}`}
            className="-mr-2.5 ml-auto flex size-10 items-center justify-center rounded-md text-subtle-foreground hover:bg-accent hover:text-foreground md:mr-0 md:size-6"
          >
            <Plus className="size-4" aria-hidden />
          </Link>
        ) : null}
      </h2>
      {cantidad > 0 ? <ul>{children}</ul> : vacio ? <p className="border-b px-4 py-3 text-[13px] text-subtle-foreground sm:px-6">{vacio}</p> : null}
    </section>
  );
}
