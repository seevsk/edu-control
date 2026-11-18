"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { accionesDisponiblesTarea, ESTADOS_TAREA_ORDEN, ETIQUETA_ESTADO_TAREA, type EstadoTarea } from "@/lib/estado-tarea";
import { StatusIcon } from "@/components/ui-app/status-icon";
import { DueChip } from "@/components/ui-app/due-chip";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import type { FilaTarea } from "@/components/ui-app/task-row";
import { moverTareaAction } from "../tareas/actions";

/** Como en Jira: el tablero solo muestra lo completado recientemente; el resto queda en la lista. */
const DIAS_COMPLETADAS_EN_TABLERO = 14;

const AVISO_MOTIVO: Partial<Record<EstadoTarea, string>> = {
  en_progreso: "Para devolverla o reabrirla escribe el motivo en el detalle.",
};

function ContenidoTarjeta({ fila, ahora }: { fila: FilaTarea; ahora: Date }) {
  const cerrada = fila.estado === "completada" || fila.estado === "descartada";
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-[15px] leading-[1.45] md:text-[13px]", cerrada && "text-muted-foreground")}>{fila.titulo}</span>
        <UserAvatar usuario={fila.asignado} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <DueChip fecha={fila.fechaLimite} cerrada={cerrada} ahora={ahora} />
        {fila.adjuntos ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${fila.adjuntos} ${fila.adjuntos === 1 ? "archivo" : "archivos"} en la entrega`}>
            <Paperclip className="size-3.5" aria-hidden />
            {fila.adjuntos}
          </span>
        ) : null}
        {fila.nota ? <span className="text-xs text-estado-en-revision">{fila.nota}</span> : null}
      </div>
    </>
  );
}

function Tarjeta({ fila, ahora, arrastrable, href }: { fila: FilaTarea; ahora: Date; arrastrable: boolean; href: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: fila.idTarea, disabled: !arrastrable });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-card",
        arrastrable && "cursor-grab touch-manipulation select-none active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <Link href={href} scroll={false} className="flex flex-col gap-2.5 p-3.5 md:p-3" draggable={false}>
        <ContenidoTarjeta fila={fila} ahora={ahora} />
      </Link>
    </article>
  );
}

function Columna({ estado, cantidad, hrefNueva, children }: { estado: EstadoTarea; cantidad: number; hrefNueva?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  return (
    <section
      ref={setNodeRef}
      aria-label={ETIQUETA_ESTADO_TAREA[estado]}
      id={`columna-${estado}`}
      className={cn("flex min-w-0 snap-start flex-col gap-2 rounded-[10px] bg-sidebar p-2 transition-colors dark:bg-transparent dark:p-1", isOver && "bg-accent dark:bg-accent")}
    >
      <h2 className="flex h-8 items-center gap-2 px-1 text-[13px] max-md:hidden">
        <StatusIcon estado={estado} />
        <span className="font-medium">{ETIQUETA_ESTADO_TAREA[estado]}</span>
        <span className="text-subtle-foreground">{cantidad}</span>
        {hrefNueva ? (
          <Link href={hrefNueva} scroll={false} aria-label={`Nueva tarea en ${ETIQUETA_ESTADO_TAREA[estado]}`} className="ml-auto flex size-6 items-center justify-center rounded-md text-subtle-foreground hover:bg-accent hover:text-foreground">
            <Plus className="size-4" aria-hidden />
          </Link>
        ) : null}
      </h2>
      {children}
      {hrefNueva ? (
        <Link href={hrefNueva} scroll={false} className="flex h-12 items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-input text-sm text-muted-foreground hover:text-foreground md:hidden">
          <Plus className="size-4" aria-hidden />
          Agregar tarea
        </Link>
      ) : null}
    </section>
  );
}

export function TableroTareas({
  idGrupo,
  filas,
  ahora,
  rol,
  idUsuario,
  activo,
  hrefTarea,
  hrefNueva,
  hrefAnteriores,
  completadasEn,
}: {
  idGrupo: number;
  filas: FilaTarea[];
  ahora: Date;
  rol: "lider" | "miembro" | "observador";
  idUsuario: number;
  activo: boolean;
  hrefTarea: Record<number, string>;
  hrefNueva?: string;
  hrefAnteriores: string;
  completadasEn: Record<number, string>;
}) {
  const router = useRouter();
  const [, iniciarTransicion] = useTransition();
  const [movidas, setMovidas] = useState<Record<number, EstadoTarea>>({});
  const carril = useRef<HTMLDivElement>(null);
  const [columnaVisible, setColumnaVisible] = useState(0);
  function irAColumna(indice: number) {
    const contenedor = carril.current;
    const columna = contenedor?.querySelectorAll<HTMLElement>("[id^=columna-]")[indice];
    if (contenedor && columna) contenedor.scrollTo({ left: columna.offsetLeft - contenedor.offsetLeft - 16, behavior: "smooth" });
  }
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const puedeMover = rol !== "observador" && activo;
  const actuales = filas.map((fila) => ({ ...fila, estado: movidas[fila.idTarea] ?? fila.estado }));
  const limite = ahora.getTime() - DIAS_COMPLETADAS_EN_TABLERO * 86_400_000;
  const ocultas = actuales.filter((fila) => fila.estado === "completada" && completadasEn[fila.idTarea] && Date.parse(completadasEn[fila.idTarea]) < limite);
  const filaArrastrada = actuales.find((fila) => fila.idTarea === arrastrando) ?? null;

  function alSoltar({ active, over }: DragEndEvent) {
    setArrastrando(null);
    const fila = actuales.find((item) => item.idTarea === active.id);
    const destino = over?.id as EstadoTarea | undefined;
    if (!fila || !destino || destino === fila.estado) return;

    // Pasar a revisión exige una entrega: en vez de mover la tarjeta se abre el formulario.
    if (destino === "en_revision" && fila.estado === "en_progreso") {
      if (fila.asignado?.idUsuario === idUsuario) {
        router.push(`${hrefTarea[fila.idTarea]}&entregar=1`, { scroll: false });
      } else {
        toast("Solo el responsable envía la entrega a revisión.");
      }
      return;
    }
    // Aprobar y devolver se hacen en el detalle, donde está la entrega que se revisa.
    if (fila.estado === "en_revision") {
      toast(rol === "lider" ? "Revisa la entrega en el detalle para aprobarla o devolverla." : "Solo el líder aprueba o devuelve una entrega.");
      router.push(hrefTarea[fila.idTarea], { scroll: false });
      return;
    }

    const accion = accionesDisponiblesTarea({ estado: fila.estado, idAsignado: fila.asignado?.idUsuario ?? null, idUsuario, rol })
      .find((opcion) => opcion.estado === destino);
    if (accion?.motivo) {
      toast(AVISO_MOTIVO[destino] ?? "Esta acción necesita un motivo; complétala en el detalle.");
      router.push(hrefTarea[fila.idTarea], { scroll: false });
      return;
    }

    setMovidas((previas) => ({ ...previas, [fila.idTarea]: destino }));
    iniciarTransicion(async () => {
      const resultado = await moverTareaAction(idGrupo, fila.idTarea, destino);
      if (!resultado.ok) {
        setMovidas((previas) => {
          const resto = { ...previas };
          delete resto[fila.idTarea];
          return resto;
        });
        toast.error(resultado.error);
      }
    });
  }

  return (
    <DndContext
      sensors={sensores}
      onDragStart={({ active }: DragStartEvent) => setArrastrando(Number(active.id))}
      onDragCancel={() => setArrastrando(null)}
      onDragEnd={alSoltar}
    >
      <div className="flex gap-2 overflow-x-auto px-4 pt-3 [scrollbar-width:none] md:hidden" role="tablist" aria-label="Columnas del tablero">
        {ESTADOS_TAREA_ORDEN.map((estado, indice) => (
          <button
            key={estado}
            type="button"
            role="tab"
            aria-selected={columnaVisible === indice}
            onClick={() => irAColumna(indice)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground",
              columnaVisible === indice && "bg-secondary text-foreground",
            )}
          >
            <StatusIcon estado={estado} />
            {ETIQUETA_ESTADO_TAREA[estado]}
            <span className="text-subtle-foreground">{actuales.filter((fila) => fila.estado === estado && !ocultas.includes(fila)).length}</span>
          </button>
        ))}
      </div>
      <div
        ref={carril}
        onScroll={(evento) => {
          const contenedor = evento.currentTarget;
          const ancho = contenedor.querySelector<HTMLElement>("[id^=columna-]")?.offsetWidth ?? 1;
          setColumnaVisible(Math.min(3, Math.round(contenedor.scrollLeft / (ancho + 12))));
        }}
        className="snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 py-4 [scrollbar-width:none] sm:px-6 md:snap-none"
      >
        <div className="grid grid-cols-[repeat(4,calc(100vw-3rem))] gap-3 md:grid-cols-[repeat(4,minmax(240px,1fr))] md:gap-4">
          {ESTADOS_TAREA_ORDEN.map((estado) => {
            const delEstado = actuales.filter((fila) => fila.estado === estado && !ocultas.includes(fila));
            return (
              <Columna key={estado} estado={estado} cantidad={delEstado.length} hrefNueva={estado === "pendiente" ? hrefNueva : undefined}>
                {delEstado.map((fila) => (
                  <Tarjeta key={fila.idTarea} fila={fila} ahora={ahora} arrastrable={puedeMover} href={hrefTarea[fila.idTarea]} />
                ))}
                {delEstado.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-subtle-foreground">
                    {puedeMover ? "Arrastra una tarea aquí" : "Sin tareas"}
                  </p>
                ) : null}
                {estado === "completada" && ocultas.length > 0 ? (
                  <Link href={hrefAnteriores} className="px-1 text-xs text-muted-foreground hover:text-foreground">
                    Ver {ocultas.length} completadas hace más de {DIAS_COMPLETADAS_EN_TABLERO} días
                  </Link>
                ) : null}
              </Columna>
            );
          })}
        </div>
      </div>
      <DragOverlay>
        {filaArrastrada ? (
          <article className="flex rotate-1 flex-col gap-2.5 rounded-lg border bg-card p-3 text-card-foreground shadow-lg">
            <ContenidoTarjeta fila={filaArrastrada} ahora={ahora} />
          </article>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
