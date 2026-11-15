import { notFound, redirect } from "next/navigation";
import { idRegistroSchema } from "@/lib/validation/tarea";

/** El detalle se abre en un panel lateral de /grupos/[id]; esta ruta mantiene vivos los enlaces de notificaciones. */
export default async function TareaDetalleRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; idTarea: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ruta = await params;
  const grupoId = idRegistroSchema.safeParse(ruta.id);
  const tareaId = idRegistroSchema.safeParse(ruta.idTarea);
  if (!grupoId.success || !tareaId.success) notFound();
  const destino = new URLSearchParams({ tarea: String(tareaId.data) });
  for (const [clave, valor] of Object.entries(await searchParams)) {
    if (typeof valor === "string" && ["error", "toast", "editar"].includes(clave)) destino.set(clave, valor);
  }
  redirect(`/grupos/${grupoId.data}?${destino.toString()}`);
}
