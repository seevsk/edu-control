import Link from "next/link";
import { Pencil } from "lucide-react";
import { estaAbierta } from "@/lib/estado-tarea";
import { nombreCorto } from "@/lib/nombres";
import { fechaEnZonaLimaISO } from "@/lib/calendario";
import { formatearFechaHoraLima } from "@/lib/dates";
import { StatusIcon } from "@/components/ui-app/status-icon";
import { DueChip } from "@/components/ui-app/due-chip";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { CampoSelect } from "@/components/ui-app/campo-select";
import { PesoTarea } from "@/components/peso-tarea";
import { AccionesTarea } from "../tareas/_components/acciones-tarea";
import { LineaTiempoTarea } from "../tareas/_components/linea-tiempo-tarea";
import { EntregasTarea } from "../tareas/_components/entregas-tarea";
import { FormularioEntrega } from "../tareas/_components/formulario-entrega";
import { RegistrarVista } from "../tareas/_components/registrar-vista";
import { editarTareaAction } from "../tareas/actions";
import type { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import type { obtenerTareaDelGrupo } from "@/server/services/tarea";

type DatosGrupo = Awaited<ReturnType<typeof obtenerGrupoDelUsuario>>;
type Tarea = Awaited<ReturnType<typeof obtenerTareaDelGrupo>>;

const CAMPO = "flex flex-col gap-1.5 text-[13px] font-medium";

export function DetalleTarea({
  datos,
  tarea,
  idUsuario,
  ahora,
  hrefBase,
  editar,
  entregar,
  error,
}: {
  datos: DatosGrupo;
  tarea: Tarea;
  idUsuario: number;
  ahora: Date;
  /** URL de la vista con ?tarea=ID, sobre la que se agrega &editar=1. */
  hrefBase: string;
  editar: boolean;
  /** Abre el formulario de envío a revisión (solo lo ve el responsable de una tarea en progreso). */
  entregar?: boolean;
  error?: string;
}) {
  const { grupo, rolActual } = datos;
  const idGrupo = grupo.idGrupo;
  const abierta = estaAbierta(tarea.estado);
  const puedeGestionar = rolActual !== "observador" && grupo.estado === "activo";
  const puedeEditar = puedeGestionar && abierta && (rolActual === "lider" || tarea.idCreador === idUsuario);
  const asignables = grupo.integrantes.filter((integrante) => integrante.estadoInvitacion === "aceptada" && integrante.rol !== "observador");
  const nombres = new Map(grupo.integrantes.map((integrante) => [integrante.idUsuario, nombreCorto(integrante.usuario.nombre, integrante.usuario.apellidos)]));
  const errorVisible = error ? <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p> : null;
  // Solo el responsable envía la entrega, y solo mientras la tarea está en progreso.
  const puedeEntregar = puedeGestionar && tarea.estado === "en_progreso" && tarea.idAsignado === idUsuario;
  const ultimaDevuelta = tarea.entregas[0]?.resultado === "devuelta" ? tarea.entregas[0] : null;

  if (entregar && puedeEntregar) {
    return (
      <FormularioEntrega
        idGrupo={idGrupo}
        idTarea={tarea.idTarea}
        hrefVolver={hrefBase}
        motivoAnterior={ultimaDevuelta?.motivoDevolucion}
      />
    );
  }

  if (editar && puedeEditar) {
    const vencida = tarea.fechaLimite !== null && tarea.fechaLimite < ahora;
    return (
      <>
        {errorVisible}
        <form action={editarTareaAction.bind(null, idGrupo, tarea.idTarea)} className="flex flex-col gap-4">
          <label className={CAMPO}>
            Título
            <Input name="titulo" required maxLength={160} defaultValue={tarea.titulo} />
          </label>
          <label className={CAMPO}>
            Descripción
            <Textarea name="descripcion" maxLength={1000} rows={4} defaultValue={tarea.descripcion ?? ""} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={CAMPO}>
              Peso
              <CampoSelect name="peso" defaultValue={String(tarea.peso)} opciones={[{ valor: "1", texto: "1 · liviana" }, { valor: "2", texto: "2 · media" }, { valor: "3", texto: "3 · pesada" }]} />
            </label>
            <label className={CAMPO}>
              Fecha límite
              <Input
                type="date"
                name="fechaLimite"
                required
                defaultValue={tarea.fechaLimite ? fechaEnZonaLimaISO(tarea.fechaLimite) : undefined}
                min={vencida ? undefined : fechaEnZonaLimaISO(ahora)}
                max={grupo.fechaLimite ? fechaEnZonaLimaISO(grupo.fechaLimite) : undefined}
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <SubmitButton className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Guardar cambios
            </SubmitButton>
            <Button variant="ghost" asChild>
              <Link href={hrefBase} scroll={false}>Cancelar</Link>
            </Button>
          </div>
        </form>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {tarea.idAsignado === idUsuario && abierta && grupo.estado === "activo" ? (
        <RegistrarVista idGrupo={idGrupo} idTarea={tarea.idTarea} />
      ) : null}
      {errorVisible}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <StatusIcon estado={tarea.estado} conTexto className="font-medium" />
        <DueChip fecha={tarea.fechaLimite} cerrada={!abierta} ahora={ahora} />
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <UserAvatar usuario={tarea.asignado ? { idUsuario: tarea.idAsignado!, ...tarea.asignado } : null} />
          {tarea.asignado ? nombreCorto(tarea.asignado.nombre, tarea.asignado.apellidos) : "Sin responsable"}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <PesoTarea peso={tarea.peso} />
          peso {tarea.peso}
        </span>
        {puedeEditar ? (
          <Button variant="outline" size="sm" className="ml-auto h-7" asChild>
            <Link href={`${hrefBase}&editar=1`} scroll={false}>
              <Pencil aria-hidden />
              Editar
            </Link>
          </Button>
        ) : null}
      </div>

      <div>
        <p className="text-[13px] whitespace-pre-wrap break-words text-muted-foreground">
          {tarea.descripcion || "Sin descripción."}
        </p>
        <p className="mt-2 text-xs text-subtle-foreground">
          Creada por {nombreCorto(tarea.creador.nombre, tarea.creador.apellidos)}
          {tarea.fechaLimite ? ` · vence el ${formatearFechaHoraLima(tarea.fechaLimite)}` : ""}
        </p>
      </div>

      {puedeGestionar ? (
        <AccionesTarea idGrupo={idGrupo} tarea={tarea} idUsuario={idUsuario} rol={rolActual} asignables={asignables} destino="detalle" titulo="Siguiente acción" />
      ) : null}

      <EntregasTarea tarea={tarea} puedeEntregar={puedeEntregar} hrefEntregar={puedeEntregar ? `${hrefBase}&entregar=1` : null} />

      <section aria-labelledby="seguimiento-tarea" className="flex flex-col gap-3 border-t pt-5">
        <h3 id="seguimiento-tarea" className="text-[13px] font-medium">Seguimiento</h3>
        <LineaTiempoTarea tarea={tarea} historial={tarea.historial} nombres={nombres} ahora={ahora} />
      </section>
    </div>
  );
}
