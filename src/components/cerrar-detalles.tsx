"use client";

/** Cierra el <details> que lo contiene: salida explicita para formularios desplegables. */
export function CerrarDetalles({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={(evento) => {
        const detalles = evento.currentTarget.closest("details");
        if (detalles) detalles.open = false;
      }}
      className={className}
    >
      Cancelar
    </button>
  );
}
