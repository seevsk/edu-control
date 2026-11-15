import { notFound, redirect } from "next/navigation";
import { idRegistroSchema } from "@/lib/validation/tarea";

/** Las tareas viven en /grupos/[id]; esta ruta se conserva por enlaces y redirecciones antiguas. */
export default async function TareasGrupoRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const grupoId = idRegistroSchema.safeParse((await params).id);
  if (!grupoId.success) notFound();
  const destino = new URLSearchParams();
  for (const [clave, valor] of Object.entries(await searchParams)) {
    if (typeof valor !== "string") continue;
    if (clave === "vista") {
      if (valor === "tablero") destino.set("vista", "tablero");
      continue;
    }
    destino.set(clave, valor);
  }
  const consulta = destino.toString();
  redirect(`/grupos/${grupoId.data}${consulta ? `?${consulta}` : ""}`);
}
