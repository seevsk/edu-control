import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { SubmitButton } from "@/components/submit-button";
import { Toast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actualizarGrupoAction } from "../../actions";
import { MarcoGrupo } from "../_components/marco-grupo";

const CAMPO = "flex flex-col gap-1.5 text-[13px] font-medium";

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
    <MarcoGrupo datos={resultado} idUsuario={sesion.idUsuario} activa="configuracion">
      <Toast mensaje={toast} />
      {error ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p> : null}

      {grupo.estado === "finalizado" ? (
        <p className="text-[13px] text-muted-foreground">
          El grupo está finalizado: su configuración es de solo lectura y los datos e historial se conservan.
        </p>
      ) : (
        <form action={actualizar} className="flex max-w-xl flex-col gap-5">
          <label className={CAMPO}>
            Nombre
            <Input name="nombre" required maxLength={120} defaultValue={grupo.nombre} />
          </label>
          <label className={CAMPO}>
            Descripción
            <Textarea name="descripcion" maxLength={500} rows={3} defaultValue={grupo.descripcion ?? ""} />
          </label>
          <label className={CAMPO}>
            Enlace del trabajo
            <Input name="enlaceTrabajo" type="url" placeholder="https://" defaultValue={grupo.enlaceTrabajo ?? ""} />
          </label>
          <label className={CAMPO}>
            Estado
            <select name="estado" defaultValue={grupo.estado} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm font-normal">
              <option value="activo">Activo</option>
              <option value="finalizado">Finalizado (solo lectura, no se puede revertir)</option>
            </select>
            <span className="text-xs font-normal text-subtle-foreground">Para finalizarlo, todas las tareas deben estar completadas o descartadas.</span>
          </label>
          <SubmitButton className="h-9 w-fit rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Guardar cambios
          </SubmitButton>
        </form>
      )}
    </MarcoGrupo>
  );
}
