import { AvisoError } from "@/components/ui-app/aviso-error";
import { metadataDeGrupo } from "../_components/metadata";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { fechaEnZonaLimaISO } from "@/lib/calendario";
import { SubmitButton } from "@/components/submit-button";
import { CampoSelect } from "@/components/ui-app/campo-select";
import { Toast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actualizarGrupoAction } from "../../actions";
import { MarcoGrupo } from "../_components/marco-grupo";

const CAMPO = "flex flex-col gap-1.5 text-[13px] font-medium";

export const generateMetadata = metadataDeGrupo("Configuración");

export default async function ConfiguracionGrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  const parametros = await searchParams;
  const { error, toast } = parametros;
  const resultado = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!resultado || resultado.rolActual !== "lider") notFound();

  const { grupo } = resultado;
  const actualizar = actualizarGrupoAction.bind(null, idGrupo);
  // Con un error se conserva lo que la persona había escrito.
  const conservar = Boolean(error);
  const escrito = (campo: string, original: string) => (conservar ? parametros[campo] ?? original : original);
  const estadoEscrito = escrito("estado", grupo.estado) === "finalizado" ? "finalizado" : "activo";
  const fechaEscrita = escrito("fechaLimite", grupo.fechaLimite ? fechaEnZonaLimaISO(grupo.fechaLimite) : "");

  return (
    <MarcoGrupo datos={resultado} idUsuario={sesion.idUsuario} activa="configuracion">
      <Toast mensaje={toast} />
      {error ? <AvisoError className="max-w-xl">{error}</AvisoError> : null}

      {grupo.estado === "finalizado" ? (
        <p className="text-[13px] text-muted-foreground">
          El grupo está finalizado: su configuración es de solo lectura y los datos e historial se conservan.
        </p>
      ) : (
        <form action={actualizar} className="flex max-w-xl flex-col gap-5">
          <label className={CAMPO}>
            Nombre
            <Input name="nombre" required maxLength={120} defaultValue={escrito("nombre", grupo.nombre)} />
          </label>
          <label className={CAMPO}>
            Descripción
            <Textarea name="descripcion" maxLength={500} rows={3} defaultValue={escrito("descripcion", grupo.descripcion ?? "")} />
          </label>
          <label className={CAMPO}>
            Enlace del trabajo
            <Input name="enlaceTrabajo" type="url" placeholder="https://" defaultValue={escrito("enlaceTrabajo", grupo.enlaceTrabajo ?? "")} />
          </label>
          <label className={CAMPO}>
            Fecha límite
            <Input name="fechaLimite" type="date" defaultValue={fechaEscrita} className="w-fit" />
          </label>
          <label className={CAMPO}>
            Estado
            <CampoSelect name="estado" defaultValue={estadoEscrito} opciones={[{ valor: "activo", texto: "Activo" }, { valor: "finalizado", texto: "Finalizado (solo lectura, no se puede revertir)" }]} />
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
