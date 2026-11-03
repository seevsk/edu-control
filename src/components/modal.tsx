"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";

type TamanoModal = "md" | "lg" | "xl";

const ANCHOS: Record<TamanoModal, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  titulo,
  descripcion,
  cerrarEn,
  tamano = "lg",
  children,
}: {
  titulo: string;
  descripcion?: string;
  cerrarEn: string;
  tamano?: TamanoModal;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idDescripcion = useId();

  useEffect(() => {
    const elemento = dialogo.current;
    if (elemento && !elemento.open) elemento.showModal();
    return () => elemento?.close();
  }, []);

  function cerrar() {
    dialogo.current?.close();
    router.replace(cerrarEn, { scroll: false });
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={descripcion ? idDescripcion : undefined}
      onCancel={(evento) => {
        evento.preventDefault();
        cerrar();
      }}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) cerrar();
      }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden rounded-lg border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-slate-950/50 ${ANCHOS[tamano]}`}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 id={idTitulo} className="text-lg font-semibold">
              {titulo}
            </h2>
            {descripcion ? (
              <p id={idDescripcion} className="mt-1 text-sm text-text-muted">
                {descripcion}
              </p>
            ) : null}
          </div>
          <Link
            href={cerrarEn}
            replace
            scroll={false}
            aria-label={`Cerrar ${titulo.toLocaleLowerCase("es-PE")}`}
            className="grid size-8 shrink-0 place-items-center rounded-md text-xl leading-none text-text-muted hover:bg-bg hover:text-text"
          >
            <span aria-hidden>×</span>
          </Link>
        </header>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </dialog>
  );
}
