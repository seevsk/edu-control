import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Aviso de error de un formulario: ícono, aire y texto que respira; ocupa el ancho de su contenedor. */
export function AvisoError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-[13px] leading-relaxed text-destructive",
        className,
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="min-w-0 text-pretty">{children}</p>
    </div>
  );
}
