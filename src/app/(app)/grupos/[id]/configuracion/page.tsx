import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { SubmitButton } from "@/components/submit-button";
import { Toast } from "@/components/toast";
import { actualizarGrupoAction } from "../../actions";
import { TabsGrupo } from "../_components/tabs-grupo";

export default async function ConfiguracionGrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; toast?: string }>;
}) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  const { error, toast } = await searchParams;
  const resultado = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!resultado || resultado.rolActual !== "lider") notFound();

  const { grupo } = resultado;
  const actualizar = actualizarGrupoAction.bind(null, idGrupo);

  return (
    <div className="animate-page-in mx-auto flex max-w-5xl flex-col gap-6">
      <Toast mensaje={toast} />
      <div>
        <Link href="/grupos" className="text-sm text-primary hover:underline">Grupos</Link>
        <h1 className="mt-1 text-xl font-semibold">{grupo.nombre}</h1>
      </div>

      <TabsGrupo idGrupo={idGrupo} activa="configuracion" mostrarConfiguracion />

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {grupo.estado === "finalizado" ? (
        <section className="rounded-md border border-border bg-surface p-5">
          <h2 className="text-sm font-medium">Grupo finalizado</h2>
          <p className="mt-1 text-sm text-text-muted">
            La configuración es de solo lectura. Los datos y el historial del grupo se conservan.
          </p>
        </section>
      ) : (
        <section className="max-w-2xl rounded-md border border-border bg-surface p-5">
          <h2 className="text-sm font-medium">Datos y estado del grupo</h2>
          <p className="mt-1 text-xs text-text-muted">Solo el líder puede modificar esta información.</p>
          <form action={actualizar} className="mt-4 grid gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Nombre
              <input name="nombre" required maxLength={120} defaultValue={grupo.nombre} className="rounded-md border border-border-strong px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Descripción
              <textarea name="descripcion" maxLength={500} rows={3} defaultValue={grupo.descripcion ?? ""} className="rounded-md border border-border-strong px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Enlace del trabajo
              <input name="enlaceTrabajo" placeholder="https://..." defaultValue={grupo.enlaceTrabajo ?? ""} className="rounded-md border border-border-strong px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Estado
              <select name="estado" defaultValue={grupo.estado} className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm">
                <option value="activo">Activo</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </label>
            <p className="rounded-md border border-cat-laboral-borde bg-cat-laboral-bg px-3 py-2 text-xs text-cat-laboral-fg">
              Al finalizar el grupo, sus integrantes y tareas quedarán en modo de solo lectura. Esta acción no se puede revertir en el MVP.
            </p>
            <SubmitButton className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
              Guardar cambios
            </SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}
