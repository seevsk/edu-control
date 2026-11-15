import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { colorAvatar, iniciales } from "@/lib/presentacion";
import { cn } from "@/lib/utils";

const TAMANOS = { xs: "size-5 text-[9px]", sm: "size-[22px] text-[10px]", md: "size-6 text-[11px]", lg: "size-8 text-xs" } as const;

/** Avatar con iniciales tenidas por usuario; "?" cuando no hay responsable. */
export function UserAvatar({
  usuario,
  tamano = "sm",
  className,
}: {
  usuario: { idUsuario: number; nombre: string; apellidos?: string | null; fotoUrl?: string | null } | null;
  tamano?: keyof typeof TAMANOS;
  className?: string;
}) {
  if (!usuario) {
    return (
      <Avatar className={cn(TAMANOS[tamano], className)} aria-label="Sin asignar">
        <AvatarFallback className="bg-secondary font-medium text-muted-foreground">?</AvatarFallback>
      </Avatar>
    );
  }
  const nombre = `${usuario.nombre} ${usuario.apellidos ?? ""}`.trim();
  return (
    <Avatar className={cn(TAMANOS[tamano], className)} title={nombre}>
      {usuario.fotoUrl ? <AvatarImage src={usuario.fotoUrl} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback className="font-medium" style={colorAvatar(usuario.idUsuario)}>
        {iniciales(usuario.nombre, usuario.apellidos)}
      </AvatarFallback>
    </Avatar>
  );
}
