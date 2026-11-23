"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const ACTIVO = "[aria-current]:not([aria-current=false]),[aria-selected=true],[data-state=active],[aria-pressed=true]";

type Props = Omit<ComponentPropsWithoutRef<"div">, "className"> & {
  as?: "div" | "nav";
  /** Clases del contenedor externo (márgenes, visibilidad por breakpoint). */
  className?: string;
  /** Clases de la fila que se desplaza (flex, gap, padding, snap...). */
  scrollerClassName?: string;
  /** Color de fondo sobre el que se ve la fila; el degradado se funde con él. */
  fondo?: string;
  /** Clases extra de los degradados (p. ej. `max-md:hidden`). */
  fadeClassName?: string;
  /** Lleva el elemento activo a la vista al montar (por defecto sí). */
  centrarActivo?: boolean;
};

/**
 * Fila con desplazamiento horizontal que avisa cuando hay más contenido: un degradado en el borde
 * (solo hacia el lado donde queda algo por ver), sin barra de scroll. Al montar lleva a la vista
 * el elemento activo (aria-current, aria-selected, data-state=active).
 */
export function FilaDesplazable({
  as: Etiqueta = "div",
  className,
  scrollerClassName,
  fondo = "var(--background)",
  fadeClassName,
  centrarActivo = true,
  children,
  ...resto
}: Props) {
  const interno = useRef<HTMLDivElement | null>(null);
  const [bordes, setBordes] = useState({ izquierda: false, derecha: false });

  useEffect(() => {
    const fila = interno.current;
    if (!fila) return;

    function medir() {
      if (!fila) return;
      const izquierda = fila.scrollLeft > 2;
      const derecha = fila.scrollLeft + fila.clientWidth < fila.scrollWidth - 2;
      setBordes((previos) => (previos.izquierda === izquierda && previos.derecha === derecha ? previos : { izquierda, derecha }));
    }

    if (centrarActivo) {
      const activo = fila.querySelector<HTMLElement>(ACTIVO);
      if (activo) {
        const caja = fila.getBoundingClientRect();
        const caja2 = activo.getBoundingClientRect();
        const margen = 40; // deja ver un poco del vecino y no queda bajo el degradado
        if (caja2.right > caja.right - margen) fila.scrollLeft += caja2.right - caja.right + margen;
        else if (caja2.left < caja.left + margen) fila.scrollLeft -= caja.left - caja2.left + margen;
      }
    }

    medir();
    fila.addEventListener("scroll", medir, { passive: true });
    const observador = new ResizeObserver(medir);
    observador.observe(fila);
    const observarHijos = () => Array.from(fila.children).forEach((hijo) => observador.observe(hijo));
    observarHijos();
    const mutaciones = new MutationObserver(() => {
      observarHijos();
      medir();
    });
    mutaciones.observe(fila, { childList: true });
    return () => {
      fila.removeEventListener("scroll", medir);
      observador.disconnect();
      mutaciones.disconnect();
    };
  }, [centrarActivo]);

  const degradado = cn("pointer-events-none absolute inset-y-0 z-10 w-8 transition-opacity duration-150", fadeClassName);
  return (
    <div className={cn("relative min-w-0", className)}>
      <Etiqueta
        {...(resto as ComponentPropsWithoutRef<"div">)}
        ref={interno}
        className={cn("overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", scrollerClassName)}
      >
        {children}
      </Etiqueta>
      <span
        aria-hidden
        className={cn(degradado, "left-0", bordes.izquierda ? "opacity-100" : "opacity-0")}
        style={{ backgroundImage: `linear-gradient(to right, ${fondo}, transparent)` }}
      />
      <span
        aria-hidden
        className={cn(degradado, "right-0", bordes.derecha ? "opacity-100" : "opacity-0")}
        style={{ backgroundImage: `linear-gradient(to left, ${fondo}, transparent)` }}
      />
    </div>
  );
}
