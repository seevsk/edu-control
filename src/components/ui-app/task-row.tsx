import Link from "next/link";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETIQUETA_ESTADO_TAREA, type EstadoTarea } from "@/lib/estado-tarea";
import { StatusIcon } from "./status-icon";
import { DueChip } from "./due-chip";
import { UserAvatar } from "./user-avatar";

export interface FilaTarea {
  idTarea: number;
  titulo: string;
  estado: EstadoTarea;
  fechaLimite: Date | null;
  asignado: { idUsuario: number; nombre: string; apellidos: string | null; fotoUrl: string | null } | null;
  /** "Te toca revisar" u otra nota corta de accion. */
  nota?: string;
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
          "flex items-center gap-3 border-b border-border-subtle px-4 text-[13px] hover:bg-muted focus-visible:bg-muted sm:px-6",
          alta ? "min-h-[52px] py-2" : "min-h-10 py-1.5",
          cerrada && "text-muted-foreground",
        )}
      >
        <StatusIcon estado={tarea.estado} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("truncate", tarea.estado === "descartada" && "line-through")}>{tarea.titulo}</span>
          {tarea.detalle ? <span className="flex items-center gap-1.5 truncate text-xs text-subtle-foreground">{tarea.detalle}</span> : null}
        </span>
        {tarea.nota ? <span className="hidden shrink-0 text-xs text-estado-en-revision sm:inline">{tarea.nota}</span> : null}
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
      <h2 className="flex h-9 items-center gap-2 border-b bg-muted px-4 text-[13px] sm:px-6">
        <StatusIcon estado={estado} />
        <span className="font-medium">{ETIQUETA_ESTADO_TAREA[estado]}</span>
        <span className="text-subtle-foreground">{cantidad}</span>
        {hrefNueva ? (
          <Link
            href={hrefNueva}
            scroll={false}
            aria-label={`Nueva tarea en ${ETIQUETA_ESTADO_TAREA[estado]}`}
            className="ml-auto flex size-6 items-center justify-center rounded-md text-subtle-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-4" aria-hidden />
          </Link>
        ) : null}
      </h2>
      {cantidad > 0 ? <ul>{children}</ul> : vacio ? <p className="border-b px-4 py-3 text-[13px] text-subtle-foreground sm:px-6">{vacio}</p> : null}
    </section>
  );
}
