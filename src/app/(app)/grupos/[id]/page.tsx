import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, Plus, X } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { listarTareasDelGrupo, obtenerTareaDelGrupo } from "@/server/services/tarea";
import { calcularAvanceGrupo } from "@/lib/metricas";
import { ESTADOS_TAREA_ORDEN, type EstadoTarea } from "@/lib/estado-tarea";
import { nombreCorto } from "@/lib/nombres";
import { fechaEnZonaLimaISO } from "@/lib/calendario";
import { filtrosTareaSchema, idRegistroSchema } from "@/lib/validation/tarea";
import { PaginaCompleta } from "@/components/ui-app/page-header";
import { PanelLateral } from "@/components/ui-app/panel-lateral";
import { ViewSwitcher } from "@/components/ui-app/view-switcher";
import { StatusGroup, TaskRow } from "@/components/ui-app/task-row";
import { StatusIcon } from "@/components/ui-app/status-icon";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { Toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EncabezadoGrupo } from "./_components/encabezado-grupo";
import { DetalleTarea } from "./_components/detalle-tarea";
import { TableroTareas } from "./_components/tablero-tareas";
import { crearTareaAction } from "./tareas/actions";

/** Orden de la lista: lo que se esta moviendo primero, lo cerrado al final. */
const ORDEN_LISTA: EstadoTarea[] = ["en_progreso", "en_revision", "pendiente", "completada"];
const CAMPO = "flex flex-col gap-1.5 text-[13px] font-medium";
const SELECT = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

function texto(valor: string | string[] | undefined) {
  return typeof valor === "string" ? valor : undefined;
}

export default async function GrupoTareasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const grupoId = idRegistroSchema.safeParse(id);
  if (!grupoId.success) notFound();
  const idGrupo = grupoId.data;
  const sesion = await requerirSesion();

  const parametros = await searchParams;
  const filtros = filtrosTareaSchema.safeParse({ estado: texto(parametros.estado), asignado: texto(parametros.asignado) });
  const estado = filtros.success ? filtros.data.estado || undefined : undefined;
  const asignado = filtros.success ? filtros.data.asignado || undefined : undefined;
  const vista = texto(parametros.vista) === "tablero" ? "tablero" : "lista";
  const idTareaAbierta = idRegistroSchema.safeParse(texto(parametros.tarea));
  const abrirNueva = texto(parametros.nueva) === "1";
  const error = texto(parametros.error);
  const toast = texto(parametros.toast);

  const datos = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!datos) notFound();
  const { grupo, rolActual } = datos;
  const puedeGestionar = rolActual !== "observador" && grupo.estado === "activo";

  const [todas, descartadas, tareaAbierta] = await Promise.all([
    listarTareasDelGrupo(sesion.idUsuario, idGrupo),
    estado === "descartada" ? listarTareasDelGrupo(sesion.idUsuario, idGrupo, { estado: "descartada" }) : Promise.resolve([]),
    idTareaAbierta.success ? obtenerTareaDelGrupo(sesion.idUsuario, idGrupo, idTareaAbierta.data).catch(() => null) : Promise.resolve(null),
  ]);
  const visibles = (estado === "descartada" ? descartadas : todas).filter(
    (tarea) => (!estado || tarea.estado === estado) && (!asignado || tarea.idAsignado === asignado),
  );

  const ahora = new Date();
  const completadas = todas.filter((tarea) => tarea.estado === "completada").length;
  const avance = calcularAvanceGrupo(todas);
  const asignables = grupo.integrantes.filter((integrante) => integrante.estadoInvitacion === "aceptada" && integrante.rol !== "observador");

  function href(cambios: Record<string, string | undefined>) {
    const destino = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      vista: vista === "tablero" ? "tablero" : undefined,
      estado,
      asignado: asignado ? String(asignado) : undefined,
      ...cambios,
    };
    for (const [clave, valor] of Object.entries(base)) if (valor) destino.set(clave, valor);
    const consulta = destino.toString();
    return `/grupos/${idGrupo}${consulta ? `?${consulta}` : ""}`;
  }
  const hrefCerrar = href({});
  const hrefTarea = (idTarea: number) => href({ tarea: String(idTarea) });

  const filas = visibles.map((tarea) => ({
    idTarea: tarea.idTarea,
    titulo: tarea.titulo,
    estado: tarea.estado,
    fechaLimite: tarea.fechaLimite,
    asignado: tarea.asignado ? { idUsuario: tarea.asignado.idUsuario, nombre: tarea.asignado.nombre, apellidos: tarea.asignado.apellidos, fotoUrl: tarea.asignado.fotoUrl } : null,
    nota: tarea.estado === "en_revision" && puedeGestionar && tarea.idAsignado !== sesion.idUsuario ? "Te toca revisar" : undefined,
  }));
  const responsableFiltrado = asignables.find((integrante) => integrante.idUsuario === asignado);

  return (
    <PaginaCompleta>
      <Toast mensaje={toast} />
      <EncabezadoGrupo
        datos={datos}
        idUsuario={sesion.idUsuario}
        activa="tareas"
        accionPrincipal={
          puedeGestionar ? (
            <Button size="sm" asChild>
              <Link href={href({ nueva: "1" })} scroll={false}>
                <Plus aria-hidden />
                Nueva tarea
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-6">
        <ViewSwitcher vista={vista} hrefLista={href({ vista: undefined })} hrefTablero={href({ vista: "tablero" })} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={estado ? "h-7" : "h-7 border-dashed text-muted-foreground"}>
              {estado ? <StatusIcon estado={estado} conTexto /> : "+ Estado"}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {[...ESTADOS_TAREA_ORDEN, "descartada" as const].map((opcion) => (
              <DropdownMenuItem key={opcion} asChild>
                <Link href={href({ estado: opcion })} scroll={false}>
                  <StatusIcon estado={opcion} conTexto />
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {estado ? (
          <Link href={href({ estado: undefined })} scroll={false} aria-label="Quitar filtro de estado" className="-ml-1 rounded p-0.5 text-subtle-foreground hover:text-foreground">
            <X className="size-3.5" aria-hidden />
          </Link>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={asignado ? "h-7" : "h-7 border-dashed text-muted-foreground"}>
              {responsableFiltrado ? (
                <>
                  <UserAvatar usuario={responsableFiltrado.usuario} tamano="xs" />
                  {nombreCorto(responsableFiltrado.usuario.nombre, responsableFiltrado.usuario.apellidos)}
                </>
              ) : "+ Asignado"}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {asignables.map((integrante) => (
              <DropdownMenuItem key={integrante.idUsuario} asChild>
                <Link href={href({ asignado: String(integrante.idUsuario) })} scroll={false}>
                  <UserAvatar usuario={integrante.usuario} tamano="xs" />
                  {nombreCorto(integrante.usuario.nombre, integrante.usuario.apellidos)}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {asignado ? (
          <Link href={href({ asignado: undefined })} scroll={false} aria-label="Quitar filtro de responsable" className="-ml-1 rounded p-0.5 text-subtle-foreground hover:text-foreground">
            <X className="size-3.5" aria-hidden />
          </Link>
        ) : null}

        {todas.length > 0 ? (
          <div className="ml-auto flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <span className="tabular-nums">{completadas} de {todas.length} completadas</span>
            <div
              className="h-1 w-28 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label="Avance del grupo según el peso de las tareas"
              aria-valuenow={Math.round((avance ?? 0) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              title={`Avance por peso: ${Math.round((avance ?? 0) * 100)} %`}
            >
              <div className="h-full rounded-full bg-estado-completada" style={{ width: `${Math.round((avance ?? 0) * 100)}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      {error && !abrirNueva && !tareaAbierta ? (
        <p role="alert" className="mx-4 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive sm:mx-6">{error}</p>
      ) : null}

      {vista === "tablero" && estado !== "descartada" ? (
        <TableroTareas
          idGrupo={idGrupo}
          filas={filas}
          ahora={ahora}
          rol={rolActual}
          idUsuario={sesion.idUsuario}
          activo={grupo.estado === "activo"}
          hrefTarea={Object.fromEntries(filas.map((fila) => [fila.idTarea, hrefTarea(fila.idTarea)]))}
          hrefNueva={puedeGestionar ? href({ nueva: "1" }) : undefined}
          hrefAnteriores={href({ vista: undefined, estado: "completada" })}
          completadasEn={Object.fromEntries(
            visibles.filter((tarea) => tarea.estado === "completada").map((tarea) => [
              tarea.idTarea,
              tarea.historial.reduce((ultima, cambio) => (cambio.accion === "estado" && cambio.fecha > ultima ? cambio.fecha : ultima), new Date(0)).toISOString(),
            ]),
          )}
        />
      ) : todas.length === 0 && !estado ? (
        <div className="px-4 py-16 text-center sm:px-6">
          <p className="text-[13px] text-muted-foreground">
            Aquí aparecerán las tareas del grupo, ordenadas por estado, con su responsable y fecha límite.
          </p>
          {puedeGestionar ? (
            <Button size="sm" className="mt-4" asChild>
              <Link href={href({ nueva: "1" })} scroll={false}><Plus aria-hidden />Crear la primera tarea</Link>
            </Button>
          ) : null}
        </div>
      ) : estado ? (
        <StatusGroup estado={estado} cantidad={filas.length} vacio="No hay tareas con estos filtros.">
          {filas.map((fila) => <TaskRow key={fila.idTarea} tarea={fila} href={hrefTarea(fila.idTarea)} ahora={ahora} />)}
        </StatusGroup>
      ) : (
        <div>
          {ORDEN_LISTA.map((grupoEstado) => {
            const delEstado = filas.filter((fila) => fila.estado === grupoEstado);
            return (
              <StatusGroup
                key={grupoEstado}
                estado={grupoEstado}
                cantidad={delEstado.length}
                hrefNueva={grupoEstado === "pendiente" && puedeGestionar ? href({ nueva: "1" }) : undefined}
              >
                {delEstado.map((fila) => <TaskRow key={fila.idTarea} tarea={fila} href={hrefTarea(fila.idTarea)} ahora={ahora} />)}
              </StatusGroup>
            );
          })}
        </div>
      )}

      {tareaAbierta ? (
        <PanelLateral titulo={tareaAbierta.titulo} cerrarEn={hrefCerrar}>
          <DetalleTarea
            datos={datos}
            tarea={tareaAbierta}
            idUsuario={sesion.idUsuario}
            ahora={ahora}
            hrefBase={hrefTarea(tareaAbierta.idTarea)}
            editar={texto(parametros.editar) === "1"}
            error={error}
          />
        </PanelLateral>
      ) : null}

      {abrirNueva && puedeGestionar ? (
        <PanelLateral titulo="Nueva tarea" cerrarEn={hrefCerrar}>
          {error ? <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p> : null}
          <form action={crearTareaAction.bind(null, idGrupo)} className="flex flex-col gap-4">
            <label className={CAMPO}>
              Título
              <Input name="titulo" required maxLength={160} autoFocus />
            </label>
            <label className={CAMPO}>
              Descripción
              <Textarea name="descripcion" maxLength={1000} rows={3} />
            </label>
            <label className={CAMPO}>
              Responsable
              <select name="idAsignado" defaultValue="" required className={SELECT}>
                <option value="" disabled>Elige a quién le toca</option>
                {asignables.map((integrante) => (
                  <option key={integrante.idUsuario} value={integrante.idUsuario}>
                    {nombreCorto(integrante.usuario.nombre, integrante.usuario.apellidos)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={CAMPO}>
                Peso
                <select name="peso" defaultValue="1" className={SELECT}>
                  <option value="1">1 · liviana</option>
                  <option value="2">2 · media</option>
                  <option value="3">3 · pesada</option>
                </select>
              </label>
              <label className={CAMPO}>
                Fecha límite
                <Input
                  type="date"
                  name="fechaLimite"
                  required
                  min={fechaEnZonaLimaISO(ahora)}
                  max={grupo.fechaLimite ? fechaEnZonaLimaISO(grupo.fechaLimite) : undefined}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <SubmitButton className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Crear tarea
              </SubmitButton>
              <Button variant="ghost" asChild>
                <Link href={hrefCerrar} scroll={false}>Cancelar</Link>
              </Button>
            </div>
          </form>
        </PanelLateral>
      ) : null}
    </PaginaCompleta>
  );
}
