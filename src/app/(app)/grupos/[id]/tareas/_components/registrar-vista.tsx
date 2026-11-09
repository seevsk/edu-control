"use client";

import { useEffect } from "react";
import { registrarVistaTareaAction } from "../actions";

/** Se registra al montar (no al renderizar en el servidor) para no contar prefetch ni recargas del servidor. */
export function RegistrarVista({ idGrupo, idTarea }: { idGrupo: number; idTarea: number }) {
  useEffect(() => {
    void registrarVistaTareaAction(idGrupo, idTarea);
  }, [idGrupo, idTarea]);
  return null;
}
