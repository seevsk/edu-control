const MODALIDAD = {
  presencial: { texto: "Presencial", clase: "border-cat-clases-borde bg-cat-clases-bg text-cat-clases-fg", punto: "bg-cat-clases" },
  remoto: { texto: "Remoto", clase: "border-cat-reunion-borde bg-cat-reunion-bg text-cat-reunion-fg", punto: "bg-cat-reunion" },
} as const;

/** Modalidad del curso con color propio, para que se distinga de un vistazo. */
export function ChipModalidad({ modalidad }: { modalidad: "presencial" | "remoto" }) {
  const { texto, clase, punto } = MODALIDAD[modalidad];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${clase}`}>
      <span className={`size-1.5 rounded-full ${punto}`} aria-hidden />
      {texto}
    </span>
  );
}
