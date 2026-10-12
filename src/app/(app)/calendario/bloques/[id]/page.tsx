import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerBloqueOcupado } from "@/server/services/disponibilidad";
import { actualizarBloqueOcupadoAction, eliminarBloqueOcupadoAction } from "../../actions";
import { FormularioBloque } from "../../_components/formulario-bloque";
import { consultaCalendario } from "../../_components/rutas";

function aHHMM(fecha: Date) {
  return `${String(fecha.getUTCHours()).padStart(2, "0")}:${String(fecha.getUTCMinutes()).padStart(2, "0")}`;
}

export default async function EditarBloquePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string; vista?: string; error?: string }>;
}) {
  const { id } = await params;
  const idBloqueOcupado = Number(id);
  if (!Number.isInteger(idBloqueOcupado)) notFound();

  const sesion = await requerirSesion();
  const { semana, vista, error } = await searchParams;
  const bloque = await obtenerBloqueOcupado(sesion.idUsuario, idBloqueOcupado);
  if (!bloque) notFound();

  const consulta = consultaCalendario(semana, vista);
  const volverA = `/calendario${consulta}`;

  return (
    <div className="animate-page-in mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <Link href={volverA} className="text-sm text-primary hover:underline">
          Calendario
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Editar bloque</h1>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="rounded-md border border-border bg-surface p-4 sm:p-6">
        <FormularioBloque
          action={actualizarBloqueOcupadoAction.bind(null, idBloqueOcupado)}
          modo="editar"
          valores={{
            tipo: bloque.tipo,
            dias: [bloque.diaSemana],
            horaInicio: aHHMM(bloque.horaInicio),
            horaFin: aHHMM(bloque.horaFin),
            detalle: bloque.detalle ?? "",
          }}
          volverA={volverA}
          origen={`/calendario/bloques/${idBloqueOcupado}${consulta}`}
        />
      </div>

      <form action={eliminarBloqueOcupadoAction.bind(null, idBloqueOcupado)} className="flex justify-end">
        <input type="hidden" name="volverA" value={volverA} />
        <button
          type="submit"
          className="rounded-md border border-danger/40 bg-surface px-4 py-2 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger/10"
        >
          Quitar bloque
        </button>
      </form>
    </div>
  );
}
