const VISTAS = ["todo", "clases", "laboral", "fam"];
const MODOS = ["mes", "semana"];

/** Parametros validos para navegar y volver al mismo periodo del calendario. */
export function consultaCalendario(semana?: string, vista?: string, modo?: string, mes?: string): string {
  const params = new URLSearchParams();
  if (semana && /^\d{4}-\d{2}-\d{2}$/.test(semana)) params.set("semana", semana);
  if (vista && VISTAS.includes(vista)) params.set("vista", vista);
  if (modo && MODOS.includes(modo)) params.set("modo", modo);
  if (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) params.set("mes", mes);
  const consulta = params.toString();
  return consulta ? `?${consulta}` : "";
}
