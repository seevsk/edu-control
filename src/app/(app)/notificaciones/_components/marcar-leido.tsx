"use client";

import { useEffect } from "react";
import { marcarElementoLeidoAction } from "../actions";

/** Marca como leído al mostrarse en el navegador (no en el render del servidor ni en un prefetch). */
export function MarcarLeido({ ids }: { ids: number[] }) {
  const clave = ids.join(",");
  useEffect(() => {
    if (clave) void marcarElementoLeidoAction(clave.split(",").map(Number));
  }, [clave]);
  return null;
}
