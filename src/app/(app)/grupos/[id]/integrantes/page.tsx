import { AvisoError } from "@/components/ui-app/aviso-error";
import { metadataDeGrupo } from "../_components/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { buscarUsuarios, obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { obtenerMetricasGrupo } from "@/server/services/metricas";
import { nombreCorto } from "@/lib/nombres";
import { BotonConfirmacion } from "@/components/boton-confirmacion";
import { SubmitButton } from "@/components/submit-button";
import { Toast } from "@/components/toast";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CampoSelect } from "@/components/ui-app/campo-select";
import { actualizarPreferenciaCorreoActividadAction, cambiarRolIntegranteAction, cancelarInvitacionAction, invitarIntegranteAction, retirarIntegranteAction, salirDelGrupoAction } from "../../actions";
import { MarcoGrupo } from "../_components/marco-grupo";

const ETIQUETAS_INVITACION: Record<string, string> = {
  pendiente: "invitación pendiente",
  retirado: "retirado",
};

const ETIQUETAS_ROL: Record<string, string> = {
  lider: "Líder",
  miembro: "Miembro",
  observador: "Observador",
};

function porcentaje(valor: number | null) {
  return valor === null ? "—" : `${Math.round(valor * 100)} %`;
}

export const generateMetadata = metadataDeGrupo("Integrantes");

export default async function IntegrantesGrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; q?: string; toast?: string }>;
}) {
  const { id } = await params;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  const { error, q, toast } = await searchParams;
  const resultado = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!resultado) notFound();

  const { grupo, rolActual } = resultado;
  const esLider = rolActual === "lider";
  const puedeAdministrar = esLider && grupo.estado === "activo";
  const [resultadosBusqueda, metricas] = await Promise.all([
    puedeAdministrar && q ? buscarUsuarios(sesion.idUsuario, q) : Promise.resolve([]),
    obtenerMetricasGrupo(sesion.idUsuario, idGrupo),
  ]);
  const metricaDe = new Map(metricas.porIntegrante.map((metrica) => [metrica.idUsuario, metrica]));
  // Quien rechazó o cuya invitación se canceló no figura como integrante y se puede volver a invitar.
  const integrantesVisibles = grupo.integrantes.filter(
    (integrante) => integrante.estadoInvitacion !== "rechazada" && integrante.estadoInvitacion !== "cancelada",
  );
  const idsYaEnGrupo = new Set(integrantesVisibles.map((integrante) => integrante.idUsuario));
  const integranteActual = grupo.integrantes.find((integrante) => integrante.idUsuario === sesion.idUsuario)!;
  // El líder solo puede salir cediendo el liderazgo a un miembro aceptado (decisión del usuario, 2026-11-16).
  const candidatosLider = grupo.integrantes.filter(
    (integrante) => integrante.estadoInvitacion === "aceptada" && integrante.rol === "miembro" && integrante.idUsuario !== sesion.idUsuario,
  );

  return (
    <MarcoGrupo datos={resultado} idUsuario={sesion.idUsuario} activa="integrantes">
      <Toast mensaje={toast} />
      {error ? <AvisoError>{error}</AvisoError> : null}

      <section aria-labelledby="titulo-integrantes">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titulo-integrantes" className="text-[13px] font-medium">Aporte de cada integrante</h2>
          <p className="text-xs text-subtle-foreground">Sin ranking: carga y cumplimiento se leen juntos</p>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full text-[13px] max-md:block">
            <thead className="bg-muted text-left text-xs text-subtle-foreground max-md:hidden">
              <tr>
                <th className="h-9 px-4 font-medium">Integrante</th>
                <th className="h-9 px-4 font-medium" title="Peso asignado sobre el total del grupo">Carga</th>
                <th className="h-9 px-4 font-medium" title="Peso completado sobre el peso asignado">Cumplimiento</th>
                <th className="h-9 px-4 font-medium" title="Entregas a revisión antes de su fecha límite">Puntualidad</th>
                {puedeAdministrar ? <th className="h-9 w-0 px-4"><span className="sr-only">Acciones</span></th> : null}
              </tr>
            </thead>
            <tbody className="max-md:block">
              {integrantesVisibles.map((integrante) => {
                const metrica = metricaDe.get(integrante.idUsuario);
                const nombre = nombreCorto(integrante.usuario.nombre, integrante.usuario.apellidos);
                const estado = integrante.estadoInvitacion === "retirado" && integrante.retiroVoluntario ? "salió del grupo" : ETIQUETAS_INVITACION[integrante.estadoInvitacion];
                return (
                  <tr key={integrante.idIntegrante} className="border-t max-md:grid max-md:grid-cols-3 max-md:gap-x-3 max-md:gap-y-2.5 max-md:px-4 max-md:py-3 max-md:first:border-t-0">
                    <td className="h-12 px-4 max-md:col-span-3 max-md:h-auto max-md:px-0">
                      <span className="flex items-center gap-2.5">
                        <UserAvatar usuario={integrante.usuario} tamano="md" />
                        <span className="min-w-0">
                          {integrante.idUsuario === sesion.idUsuario ? (
                            <span className="block truncate">{nombre} <span className="text-subtle-foreground">(tú)</span></span>
                          ) : (
                            <Link href={`/usuarios/${integrante.idUsuario}`} className="block truncate hover:underline">{nombre}</Link>
                          )}
                          <span className="block text-xs text-subtle-foreground">
                            {ETIQUETAS_ROL[integrante.rol]}{estado ? ` · ${estado}` : ""}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 tabular-nums max-md:px-0 before:content-['Carga'] before:block before:text-xs before:text-subtle-foreground md:before:hidden">{metrica ? porcentaje(metrica.carga) : "—"}</td>
                    <td className="px-4 tabular-nums max-md:px-0 before:content-['Cumplimiento'] before:block before:text-xs before:text-subtle-foreground md:before:hidden">{metrica ? porcentaje(metrica.cumplimiento) : "—"}</td>
                    <td className="px-4 tabular-nums max-md:px-0 before:content-['Puntualidad'] before:block before:text-xs before:text-subtle-foreground md:before:hidden">{metrica ? porcentaje(metrica.puntualidad) : "—"}</td>
                    {puedeAdministrar ? (
                      <td className="px-4 text-right max-md:col-span-3 max-md:-ml-2.5 max-md:px-0 max-md:text-left empty:hidden">
                        {integrante.estadoInvitacion === "pendiente" ? (
                          <form action={cancelarInvitacionAction.bind(null, idGrupo, integrante.idUsuario)}>
                            <BotonConfirmacion
                              mensaje={`¿Cancelar la invitación a ${nombre}? Podrás volver a invitarla.`}
                              className="whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 max-md:min-h-11"
                            >
                              Cancelar invitación
                            </BotonConfirmacion>
                          </form>
                        ) : integrante.rol !== "lider" && integrante.estadoInvitacion === "aceptada" ? (
                          <div className="flex items-center justify-end gap-1 max-md:justify-start">
                            {integrante.rol === "miembro" ? (
                              <form action={cambiarRolIntegranteAction.bind(null, idGrupo, integrante.idUsuario, "observador")}>
                                <BotonConfirmacion
                                  mensaje={`¿Pasar a ${nombre} a observador? Sus tareas abiertas quedarán sin asignar y solo podrá ver el grupo.`}
                                  className="min-h-8 whitespace-nowrap rounded-md max-md:min-h-11 px-2.5 py-1 text-xs font-medium hover:bg-accent"
                                >
                                  Hacer observador
                                </BotonConfirmacion>
                              </form>
                            ) : (
                              <form action={cambiarRolIntegranteAction.bind(null, idGrupo, integrante.idUsuario, "miembro")}>
                                <SubmitButton pendingText="Guardando..." className="min-h-8 whitespace-nowrap rounded-md max-md:min-h-11 px-2.5 py-1 text-xs font-medium hover:bg-accent">
                                  Hacer miembro
                                </SubmitButton>
                              </form>
                            )}
                            <form action={retirarIntegranteAction.bind(null, idGrupo, integrante.idUsuario)}>
                              <BotonConfirmacion
                                mensaje={`¿Retirar a ${nombre} del grupo? Sus tareas abiertas quedarán sin asignar.`}
                                className="min-h-8 whitespace-nowrap rounded-md max-md:min-h-11 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                              >
                                Retirar
                              </BotonConfirmacion>
                            </form>
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {puedeAdministrar ? (
        <section id="invitar" aria-labelledby="titulo-invitar" className="scroll-mt-4">
          <h2 id="titulo-invitar" className="text-[13px] font-medium">Invitar a alguien</h2>
          <form action={`/grupos/${idGrupo}/integrantes`} className="mt-3 flex max-w-xl gap-2">
            <Input type="search" name="q" defaultValue={q ?? ""} placeholder="Nombre (3 letras o más) o correo exacto" aria-label="Buscar persona" />
            <Button type="submit" variant="outline">Buscar</Button>
          </form>
          {q ? (
            <ul className="mt-3 max-w-xl overflow-hidden rounded-lg border">
              {resultadosBusqueda.map((persona) => (
                <li key={persona.idUsuario} className="flex min-h-12 items-center justify-between gap-3 border-b px-4 text-[13px] last:border-0">
                  <span className="flex items-center gap-2.5">
                    <UserAvatar usuario={persona} tamano="md" />
                    <Link href={`/usuarios/${persona.idUsuario}`} className="hover:underline">
                      {nombreCorto(persona.nombre, persona.apellidos)}
                    </Link>
                  </span>
                  {idsYaEnGrupo.has(persona.idUsuario) ? (
                    <span className="text-xs text-subtle-foreground">Ya está en el grupo o fue invitado</span>
                  ) : (
                    <form action={invitarIntegranteAction.bind(null, idGrupo)} className="flex items-center gap-2">
                      <input type="hidden" name="idUsuario" value={persona.idUsuario} />
                      <CampoSelect
                        name="rol"
                        defaultValue="miembro"
                        className="h-8 w-[118px]"
                        opciones={[{ valor: "miembro", texto: "Miembro" }, { valor: "observador", texto: "Observador" }]}
                      />
                      <Button type="submit" size="sm" variant="outline">Invitar</Button>
                    </form>
                  )}
                </li>
              ))}
              {resultadosBusqueda.length === 0 ? (
                <li className="px-4 py-4 text-[13px] text-subtle-foreground">Nadie coincide. Solo aparecen personas registradas y visibles en la búsqueda.</li>
              ) : null}
            </ul>
          ) : null}
        </section>
      ) : null}

      {rolActual !== "observador" ? (
        <section aria-labelledby="titulo-correos" className="border-t pt-5">
          <h2 id="titulo-correos" className="text-[13px] font-medium">Tus correos de este grupo</h2>
          {grupo.estado === "activo" ? (
            <form action={actualizarPreferenciaCorreoActividadAction.bind(null, idGrupo)} className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" name="correoActividad" defaultChecked={integranteActual.correoActividad} className="size-4 accent-primary" />
                Recibir correos de actividad (tareas en revisión y completadas)
              </label>
              <SubmitButton pendingText="Guardando..." className="h-8 rounded-md border border-input px-3 text-[13px] hover:bg-accent">
                Guardar
              </SubmitButton>
            </form>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Correos de actividad {integranteActual.correoActividad ? "activados" : "desactivados"}.
            </p>
          )}
          <p className="mt-2 text-xs text-subtle-foreground">Invitaciones, asignaciones, devoluciones y reuniones siempre llegan.</p>
        </section>
      ) : null}

      {grupo.estado === "activo" ? (
        <section aria-labelledby="titulo-salir" className="flex flex-wrap items-center gap-4 rounded-lg border border-destructive/30 p-4">
          <div className="min-w-[240px] flex-1">
            <h2 id="titulo-salir" className="text-[13px] font-medium">Salir del grupo</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {esLider
                ? candidatosLider.length
                  ? "Elige quién queda como líder. Tus tareas abiertas quedarán sin asignar."
                  : "Para salir necesitas otro miembro aceptado que quede como líder."
                : "Dejarás de ver el grupo. Tus tareas abiertas quedarán sin asignar y tu aporte se conserva."}
            </p>
          </div>
          {!esLider || candidatosLider.length ? (
            <form action={salirDelGrupoAction.bind(null, idGrupo)} className="flex flex-wrap items-center gap-2">
              {esLider ? (
                <label className="flex items-center gap-2 text-[13px]">
                  <span className="sr-only">Nuevo líder</span>
                  <select name="nuevoLider" required defaultValue="" className="h-8 rounded-md border border-input bg-background px-2 text-[13px]">
                    <option value="" disabled>Nuevo líder…</option>
                    {candidatosLider.map((candidato) => (
                      <option key={candidato.idUsuario} value={candidato.idUsuario}>
                        {nombreCorto(candidato.usuario.nombre, candidato.usuario.apellidos)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <BotonConfirmacion
                mensaje={`¿Salir de ${grupo.nombre}? No podrás volver a entrar a este grupo.`}
                className="inline-flex h-8 items-center rounded-md border border-input px-3 text-[13px] font-medium text-destructive hover:bg-destructive/10"
              >
                Salir del grupo
              </BotonConfirmacion>
            </form>
          ) : null}
        </section>
      ) : null}
    </MarcoGrupo>
  );
}
