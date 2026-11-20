import { UserAvatar } from "@/components/ui-app/user-avatar";
import { nombreCorto } from "@/lib/nombres";

export interface PersonaLista {
  idUsuario: number;
  nombre: string;
  apellidos: string | null;
  fotoUrl: string | null;
  /** Hora de entrada u otro dato a la derecha. */
  hora?: string;
}

/** Lista de personas: avatar de 22 px, nombre ("Tú" para uno mismo) y, si hay, una hora a la derecha. */
export function ListaPersonas({ personas, idUsuarioActual }: { personas: PersonaLista[]; idUsuarioActual: number }) {
  return (
    <ul>
      {personas.map((p) => (
        <li key={p.idUsuario} className="flex min-h-9 items-center gap-2.5 text-sm">
          <UserAvatar usuario={p} tamano="md" />
          <span className="min-w-0 flex-1 truncate">{p.idUsuario === idUsuarioActual ? "Tú" : nombreCorto(p.nombre, p.apellidos)}</span>
          {p.hora ? <span className="font-mono text-xs text-subtle-foreground">{p.hora}</span> : null}
        </li>
      ))}
    </ul>
  );
}
