import Image from "next/image";

function iniciales(nombre: string, apellidos?: string | null) {
  const segunda = apellidos?.trim()[0] ?? "";
  return `${nombre.trim()[0] ?? ""}${segunda}`.toUpperCase();
}

const TAMANOS = {
  sm: { clase: "size-6 text-[10px]", px: 24 },
  md: { clase: "size-7 text-xs", px: 28 },
} as const;

export function Avatar({
  nombre,
  apellidos,
  fotoUrl,
  tamano = "md",
}: {
  nombre: string;
  apellidos?: string | null;
  fotoUrl?: string | null;
  tamano?: keyof typeof TAMANOS;
}) {
  const { clase, px } = TAMANOS[tamano];

  if (fotoUrl) {
    return (
      <Image
        src={fotoUrl}
        alt=""
        width={px}
        height={px}
        className={`${clase} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`flex ${clase} shrink-0 items-center justify-center rounded-full bg-primary-soft font-medium text-primary`}
    >
      {iniciales(nombre, apellidos)}
    </span>
  );
}
