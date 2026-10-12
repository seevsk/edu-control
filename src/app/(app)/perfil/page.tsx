import { requerirSesion } from "@/server/auth/session";
import { obtenerPerfilCompleto } from "@/server/services/perfil";
import { formatearFechaLima } from "@/lib/dates";
import { SubmitButton } from "@/components/submit-button";
import { actualizarPerfilAction, eliminarCuentaAction } from "./actions";

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sesion = await requerirSesion();
  const { error } = await searchParams;
  const usuario = await obtenerPerfilCompleto(sesion.idUsuario);
  const perfil = usuario.perfil!;

  return (
    <div className="animate-page-in mx-auto flex max-w-2xl flex-col gap-8">
      <h1 className="text-xl font-semibold">Perfil</h1>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-medium">Tu cuenta</h2>
        <p className="mt-2 text-sm text-text-muted">
          {usuario.correo} · Miembro desde {formatearFechaLima(usuario.fechaRegistro)}
        </p>

        <form action={actualizarPerfilAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Nombre
            <input
              name="nombre"
              required
              maxLength={120}
              defaultValue={usuario.nombre}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Apellidos
            <input
              name="apellidos"
              maxLength={120}
              defaultValue={usuario.apellidos ?? ""}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Tipo de cuenta
            <select
              name="tipoCuenta"
              defaultValue={perfil.tipoCuenta}
              className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
            >
              <option value="estudiante">Estudiante</option>
              <option value="profesor">Profesor</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Institucion
            <input
              name="institucion"
              maxLength={160}
              defaultValue={perfil.institucion ?? ""}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Carrera
            <input
              name="carrera"
              maxLength={160}
              defaultValue={perfil.carrera ?? ""}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ciclo
            <input
              type="number"
              name="ciclo"
              min={1}
              max={20}
              defaultValue={perfil.ciclo ?? ""}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Biografia
            <textarea
              name="biografia"
              maxLength={300}
              rows={2}
              defaultValue={perfil.biografia ?? ""}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="trabaja" defaultChecked={perfil.trabaja} />
            Trabajo ademas de estudiar
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="visibleEnBusqueda" defaultChecked={perfil.visibleEnBusqueda} />
            Que otros me encuentren al buscar companeros
          </label>
          <SubmitButton className="mt-1 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover sm:col-span-2">
            Guardar cambios
          </SubmitButton>
        </form>
      </section>

      <section className="rounded-md border border-danger/30 bg-danger/5 p-4">
        <h2 className="text-sm font-medium text-danger">Eliminar cuenta</h2>
        <p className="mt-1 text-xs text-text-muted">
          Tu nombre, apellidos, correo y foto se borran. Tus tareas y su historial se conservan
          para no romper los grupos de los que fuiste parte. Esto no se puede deshacer.
        </p>
        <form action={eliminarCuentaAction} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Escribe ELIMINAR para confirmar
            <input
              name="confirmacion"
              required
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm"
            />
          </label>
          <SubmitButton className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Eliminar mi cuenta
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
