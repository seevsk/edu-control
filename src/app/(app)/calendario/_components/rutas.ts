const VISTAS = ["todo", "clases", "laboral", "fam"];

/** "?semana=2026-10-05&vista=laboral" con solo los valores validos, para volver a la misma vista. */
export function consultaCalendario(semana?: string, vista?: string): string {
  const params = new URLSearchParams();
  if (semana && /^\d{4}-\d{2}-\d{2}$/.test(semana)) params.set("semana", semana);
  if (vista && VISTAS.includes(vista)) params.set("vista", vista);
  const consulta = params.toString();
  return consulta ? `?${consulta}` : "";
}
