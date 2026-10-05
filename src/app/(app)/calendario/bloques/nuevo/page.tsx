import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { crearBloqueOcupadoAction } from "../../actions";
import { FormularioBloque } from "../../_components/formulario-bloque";
import { consultaCalendario } from "../../_components/rutas";

export default async function NuevoBloquePage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; vista?: string; error?: string }>;
}) {
  await requerirSesion();
  const { semana, vista, error } = await searchParams;
  const consulta = consultaCalendario(semana, vista);

  return (
    <div className="animate-page-in mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <Link href={`/calendario${consulta}`} className="text-sm text-primary hover:underline">
          Calendario
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Agregar bloque</h1>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="rounded-md border border-border bg-surface p-4 sm:p-6">
        <FormularioBloque
          action={crearBloqueOcupadoAction}
          modo="crear"
          valores={{
            tipo: vista === "fam" ? "familiar" : "laboral",
            dias: [],
            horaInicio: "09:00",
            horaFin: "13:00",
            detalle: "",
          }}
          volverA={`/calendario${consulta}`}
          origen={`/calendario/bloques/nuevo${consulta}`}
        />
      </div>
    </div>
  );
}
