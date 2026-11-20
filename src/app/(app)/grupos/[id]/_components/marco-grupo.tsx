import type { ReactNode } from "react";
import { PaginaCompleta } from "@/components/ui-app/page-header";
import { EncabezadoGrupo, type PestanaGrupo } from "./encabezado-grupo";
import type { obtenerGrupoDelUsuario } from "@/server/services/grupo";

type DatosGrupo = Awaited<ReturnType<typeof obtenerGrupoDelUsuario>>;

/** Encabezado comun del grupo + contenido de la pestaña con el mismo margen en todas. */
export function MarcoGrupo({
  datos,
  idUsuario,
  activa,
  accionPrincipal,
  accionMovil,
  superponer,
  children,
}: {
  datos: DatosGrupo;
  idUsuario: number;
  activa: PestanaGrupo;
  accionPrincipal?: ReactNode;
  accionMovil?: ReactNode;
  /** Se dibuja encima de todo el contenido (por ejemplo, un botón flotante móvil). */
  superponer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PaginaCompleta>
      <EncabezadoGrupo datos={datos} idUsuario={idUsuario} activa={activa} accionPrincipal={accionPrincipal} accionMovil={accionMovil} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 sm:px-6">{children}</div>
      {superponer}
    </PaginaCompleta>
  );
}
