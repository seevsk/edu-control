import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { OPCIONES_HORA, fechaEnZonaLimaISO } from "@/lib/calendario";
import { SubmitButton } from "@/components/submit-button";
import { crearReunionAction } from "../actions";

const CAMPO = "rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-normal";
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export default async function NuevaReunionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fecha?: string; inicio?: string; fin?: string; error?: string }>;
}) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  let grupo, rolActual;
  try {
    ({ grupo, rolActual } = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo));
  } catch {
    notFound();
  }
  if (rolActual === "observador" || grupo.estado !== "activo") notFound();

  const { fecha, inicio, fin, error } = await searchParams;
  const hoyISO = fechaEnZonaLimaISO(new Date());
  const fechaInicial = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= hoyISO ? fecha : "";
  const inicioInicial = inicio && HORA.test(inicio) ? inicio : "18:00";
  const finInicial = fin && HORA.test(fin) ? fin : "19:00";
  const lista = `/grupos/${idGrupo}/reuniones`;

  return (
    <div className="animate-page-in mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <Link href={lista} className="text-sm text-primary hover:underline">
          {grupo.nombre}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Programar reunión</h1>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <form
        action={crearReunionAction.bind(null, idGrupo)}
        className="flex flex-col gap-5 rounded-md border border-border bg-surface p-4 sm:p-6"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Título
          <input name="titulo" required maxLength={120} placeholder="Ej. Avance del informe" className={`${CAMPO} placeholder:text-text-muted`} />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Fecha
            <input type="date" name="fecha" required min={hoyISO} defaultValue={fechaInicial} className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Desde
            <select name="horaInicio" defaultValue={inicioInicial} required className={`${CAMPO} tabular-nums`}>
              {OPCIONES_HORA.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Hasta
            <select name="horaFin" defaultValue={finInicial} required className={`${CAMPO} tabular-nums`}>
              {OPCIONES_HORA.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>
              Lugar <span className="font-normal text-text-muted">(opcional)</span>
            </span>
            <input name="lugar" maxLength={160} placeholder="Ej. Biblioteca, sala 3" className={`${CAMPO} placeholder:text-text-muted`} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>
              Enlace <span className="font-normal text-text-muted">(opcional)</span>
            </span>
            <input name="enlace" type="url" placeholder="https://meet.google.com/..." className={`${CAMPO} placeholder:text-text-muted`} />
          </label>
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-5">
          <SubmitButton className="justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
            Programar reunión
          </SubmitButton>
          <Link
            href={lista}
            className="rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-medium transition-colors duration-150 hover:bg-bg"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
