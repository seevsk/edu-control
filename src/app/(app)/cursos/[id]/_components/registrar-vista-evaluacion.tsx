"use client";

import { useEffect } from "react";
import { registrarVistaEvaluacionAction } from "../../actions";

/** Se registra al montar (no en el render del servidor) para no contar prefetch. */
export function RegistrarVistaEvaluacion({ idEvaluacion }: { idEvaluacion: number }) {
  useEffect(() => {
    void registrarVistaEvaluacionAction(idEvaluacion);
  }, [idEvaluacion]);
  return null;
}
