"use client";

export function BotonConfirmacion({
  children,
  mensaje,
  className = "",
}: {
  children: React.ReactNode;
  mensaje: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(evento) => {
        if (!window.confirm(mensaje)) evento.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
