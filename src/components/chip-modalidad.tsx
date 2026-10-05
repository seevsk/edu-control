import { IconPresencial, IconRemoto } from "@/components/icons";

const MODALIDAD = {
  presencial: { texto: "Presencial", clase: "text-cat-clases-fg", Icono: IconPresencial },
  remoto: { texto: "Remoto", clase: "text-cat-reunion-fg", Icono: IconRemoto },
} as const;

/** Modalidad del curso: icono y color propios, sin pastilla, para distinguirla sin ruido. */
export function ChipModalidad({ modalidad }: { modalidad: "presencial" | "remoto" }) {
  const { texto, clase, Icono } = MODALIDAD[modalidad];
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${clase}`}>
      <Icono className="size-3.5 shrink-0" aria-hidden />
      {texto}
    </span>
  );
}
