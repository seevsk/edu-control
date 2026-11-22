import type { Metadata } from "next";
import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { listarTareasAsignadasAlUsuario, listarTareasPorRevisar } from "@/server/services/tarea";
import { listarCursos } from "@/server/services/curso";
import { listarInvitacionesPendientes, listarMisGrupos } from "@/server/services/grupo";
import { obtenerCalendarioEntre } from "@/server/services/calendario";
import { horaLima, timeAHora } from "@/lib/dates";
import { diaMesCorto, diaSemanaISO, diasHasta, etiquetaFechaLarga, fechaEnZonaLimaISO, sumarDiasISO } from "@/lib/calendario";
import { aOracion, colorCurso } from "@/lib/presentacion";
import { nombreCorto } from "@/lib/nombres";
import { EncabezadoMovil, PaginaCompleta, PageHeader } from "@/components/ui-app/page-header";
import { TaskRow, type FilaTarea } from "@/components/ui-app/task-row";
import { CourseDot } from "@/components/ui-app/course-dot";
import { Toast } from "@/components/toast";
import { cookies } from "next/headers";
import { nombrePila } from "@/lib/nombres";
import { obtenerPerfilCompleto } from "@/server/services/perfil";
import { Bienvenida } from "./_components/bienvenida";
import { COOKIE_BIENVENIDA } from "./_components/bienvenida-cookie";

export const metadata: Metadata = { title: "Tu trabajo" };

const DIAS_AGENDA = 7;
const MAX_AGENDA = 8;
const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

interface ItemAgenda {
  clave: string;
  orden: number;
  dia: string;
  hora: string;
  titulo: string;
  tipo: string;
  color: string;
  href: string;
}

function Seccion({ titulo, cantidad, children }: { titulo: string; cantidad: number; children: React.ReactNode }) {
  return (
    <section aria-label={titulo}>
      <h2 className="flex items-center gap-2 border-b border-border-subtle px-4 pt-5 pb-2 text-[13px] font-semibold text-muted-foreground sm:px-8 md:h-10 md:border-border md:bg-muted md:py-0 md:font-medium md:text-foreground">
        {titulo}
        <span className="font-normal text-subtle-foreground">{cantidad}</span>
      </h2>
      {children}
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="border-b px-4 py-4 text-[13px] text-subtle-foreground sm:px-8">{children}</p>;
}

export default async function InicioPage({ searchParams }: { searchParams: Promise<{ toast?: string }> }) {
  const sesion = await requerirSesion();
  const { toast } = await searchParams;
  const ahora = new Date();
  const hoyISO = fechaEnZonaLimaISO(ahora);
  const [mias, porRevisar, cursos, grupos, invitaciones, agenda, usuario, galletas] = await Promise.all([
    listarTareasAsignadasAlUsuario(sesion.idUsuario, 50),
    listarTareasPorRevisar(sesion.idUsuario),
    listarCursos(sesion.idUsuario),
    listarMisGrupos(sesion.idUsuario),
    listarInvitacionesPendientes(sesion.idUsuario),
    obtenerCalendarioEntre(sesion.idUsuario, hoyISO, sumarDiasISO(hoyISO, DIAS_AGENDA)),
    obtenerPerfilCompleto(sesion.idUsuario),
    cookies(),
  ]);

  const detalleGrupo = (grupo: { nombre: string; evaluacion: { curso: { idCurso: number; nombre: string } } | null }) => (
    <>
      {grupo.evaluacion ? <CourseDot idCurso={grupo.evaluacion.curso.idCurso} /> : null}
      {aOracion(grupo.nombre)}
      {grupo.evaluacion ? ` · ${aOracion(grupo.evaluacion.curso.nombre)}` : ""}
    </>
  );

  const aFila = (tarea: (typeof mias)[number]): FilaTarea => ({
    idTarea: tarea.idTarea,
    titulo: tarea.titulo,
    estado: tarea.estado,
    fechaLimite: tarea.fechaLimite,
    asignado: null,
    detalle: detalleGrupo(tarea.grupo),
  });
  const teToca = mias.filter((tarea) => tarea.estado !== "en_revision");
  const esperandoOtros = mias.filter((tarea) => tarea.estado === "en_revision");
  const entregasHoy = teToca.filter((tarea) => tarea.fechaLimite && diasHasta(tarea.fechaLimite, ahora) === 0 && tarea.fechaLimite > ahora).length;

  const resumen = [
    entregasHoy ? `tienes ${entregasHoy} ${entregasHoy === 1 ? "entrega" : "entregas"} hoy` : null,
    porRevisar.length ? `${porRevisar.length} ${porRevisar.length === 1 ? "revisión pendiente" : "revisiones pendientes"}` : null,
    invitaciones.length ? `${invitaciones.length} ${invitaciones.length === 1 ? "invitación" : "invitaciones"} por responder` : null,
  ].filter(Boolean);

  const etiquetaDia = (fechaISO: string) => {
    if (fechaISO === hoyISO) return "Hoy";
    if (fechaISO === sumarDiasISO(hoyISO, 1)) return "Mañana";
    const [, , dia] = fechaISO.split("-").map(Number);
    return `${DIAS_CORTOS[diaSemanaISO(fechaISO) - 1]} ${dia}`;
  };
  const minutos = (fecha: Date) => fecha.getUTCHours() * 60 + fecha.getUTCMinutes();
  const items: ItemAgenda[] = [];
  for (let indice = 0; indice < DIAS_AGENDA; indice++) {
    const fechaISO = sumarDiasISO(hoyISO, indice);
    for (const horario of agenda.horarios.filter((sesion) => sesion.diaSemana === diaSemanaISO(fechaISO))) {
      const inicio = new Date(`${fechaISO}T00:00:00-05:00`).getTime() + minutos(horario.horaInicio) * 60_000;
      if (inicio < ahora.getTime()) continue;
      items.push({
        clave: `clase-${horario.idHorario}-${fechaISO}`,
        orden: inicio,
        dia: etiquetaDia(fechaISO),
        hora: timeAHora(horario.horaInicio),
        titulo: aOracion(horario.curso.nombre),
        tipo: horario.curso.modalidad ? `Clase · ${horario.curso.modalidad === "presencial" ? "presencial" : "remota"}` : "Clase",
        color: colorCurso(horario.curso.idCurso),
        href: `/cursos/${horario.curso.idCurso}`,
      });
    }
  }
  for (const evaluacion of agenda.evaluaciones) {
    if (evaluacion.fechaCierre < ahora || evaluacion.estado === "completada") continue;
    items.push({
      clave: `evaluacion-${evaluacion.idEvaluacion}`,
      orden: evaluacion.fechaCierre.getTime(),
      dia: etiquetaDia(fechaEnZonaLimaISO(evaluacion.fechaCierre)),
      hora: horaLima(evaluacion.fechaCierre),
      titulo: evaluacion.nombre,
      tipo: `Evaluación · ${aOracion(evaluacion.curso.nombre)}`,
      color: colorCurso(evaluacion.curso.idCurso),
      href: `/cursos/${evaluacion.curso.idCurso}?evaluacion=${evaluacion.idEvaluacion}`,
    });
  }
  for (const tarea of agenda.tareas) {
    if (!tarea.fechaLimite || tarea.fechaLimite < ahora || tarea.estado === "completada") continue;
    items.push({
      clave: `tarea-${tarea.idTarea}`,
      orden: tarea.fechaLimite.getTime(),
      dia: etiquetaDia(fechaEnZonaLimaISO(tarea.fechaLimite)),
      hora: horaLima(tarea.fechaLimite),
      titulo: tarea.titulo,
      tipo: `Tarea · ${aOracion(tarea.grupo.nombre)}`,
      color: "var(--estado-en-progreso)",
      href: `/grupos/${tarea.idGrupo}?tarea=${tarea.idTarea}`,
    });
  }
  for (const reunion of agenda.reuniones) {
    if (reunion.fin < ahora) continue;
    items.push({
      clave: `reunion-${reunion.idReunion}`,
      orden: reunion.inicio.getTime(),
      dia: etiquetaDia(fechaEnZonaLimaISO(reunion.inicio)),
      hora: horaLima(reunion.inicio),
      titulo: reunion.titulo,
      tipo: "Reunión",
      color: "var(--cat-reunion)",
      href: `/grupos/${reunion.idGrupo}/reuniones`,
    });
  }
  const proximas = items.sort((a, b) => a.orden - b.orden).slice(0, MAX_AGENDA);
  // Guía de primer ingreso: visible hasta completar los tres pasos o hasta que el usuario la oculte.
  const perfil = usuario.perfil;
  const datosBienvenida = {
    nombre: nombrePila(usuario.nombre) || usuario.nombre,
    perfilCompleto: Boolean(perfil?.institucion && perfil.carrera && perfil.ciclo),
    visibleEnBusqueda: perfil?.visibleEnBusqueda ?? true,
    cursosConHorario: cursos.filter((curso) => curso.horarios.length > 0).length,
    tieneGrupo: grupos.length > 0,
    invitacionesPendientes: invitaciones.length,
    sesiones: cursos.flatMap((curso) =>
      curso.horarios
        .filter((horario) => horario.diaSemana <= 5)
        .map((horario) => ({ idCurso: curso.idCurso, diaSemana: horario.diaSemana, inicioMin: minutos(horario.horaInicio), finMin: minutos(horario.horaFin) })),
    ),
  };
  const guiaPendiente = !datosBienvenida.perfilCompleto || !datosBienvenida.cursosConHorario || !datosBienvenida.tieneGrupo;
  const mostrarBienvenida = guiaPendiente && galletas.get(COOKIE_BIENVENIDA)?.value !== "1";
  const contextoInicio = `${etiquetaFechaLarga(hoyISO)}${resumen.length ? ` · ${resumen.join(" y ")}` : " · nada urgente por ahora"}`;

  return (
    <PaginaCompleta>
      <Toast mensaje={toast} />
      <EncabezadoMovil titulo="Tu trabajo" contexto={contextoInicio} />
      <PageHeader titulo="Tu trabajo" contexto={<span>{contextoInicio}</span>} ocultarEnMovil />
      {mostrarBienvenida ? <Bienvenida datos={datosBienvenida} fechaTexto="Primeros pasos" /> : null}
      <div className="flex flex-1 flex-wrap">
        <div className="min-w-0 flex-[999_1_480px]">

          <Seccion titulo="Te toca" cantidad={teToca.length}>
            {teToca.length ? (
              <ul>
                {teToca.map((tarea) => (
                  <TaskRow key={tarea.idTarea} tarea={aFila(tarea)} href={`/grupos/${tarea.idGrupo}?tarea=${tarea.idTarea}`} ahora={ahora} alta conAvatar={false} />
                ))}
              </ul>
            ) : (
              <Vacio>Cuando te asignen una tarea en algún grupo aparecerá aquí, ordenada por su fecha límite.</Vacio>
            )}
          </Seccion>

          <Seccion titulo="Esperando tu revisión" cantidad={porRevisar.length}>
            {porRevisar.length ? (
              <ul>
                {porRevisar.map((tarea) => (
                  <li key={tarea.idTarea}>
                    <Link
                      href={`/grupos/${tarea.grupo.idGrupo}?tarea=${tarea.idTarea}`}
                      className="flex min-h-[60px] items-center gap-3 border-b border-border-subtle px-4 py-2.5 text-[15px] hover:bg-muted sm:px-8 md:min-h-[52px] md:py-2 md:text-[13px]"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate">{tarea.titulo}</span>
                        <span className="flex items-center gap-1.5 truncate text-[13px] text-subtle-foreground md:text-xs">
                          {detalleGrupo(tarea.grupo)}
                          {tarea.asignado ? ` · ${nombreCorto(tarea.asignado.nombre, tarea.asignado.apellidos)} la terminó` : ""}
                          {tarea.fechaTerminada ? ` el ${diaMesCorto(fechaEnZonaLimaISO(tarea.fechaTerminada))}` : ""}
                        </span>
                      </span>
                      <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-input px-3 text-[13px] md:h-7 md:rounded-md md:px-2.5">Revisar</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio>Cuando alguien envíe una entrega en un grupo que lideras, aparecerá aquí para que la apruebes o la devuelvas.</Vacio>
            )}
          </Seccion>

          <Seccion titulo="Esperando a otros" cantidad={esperandoOtros.length}>
            {esperandoOtros.length ? (
              <ul>
                {esperandoOtros.map((tarea) => (
                  <TaskRow key={tarea.idTarea} tarea={aFila(tarea)} href={`/grupos/${tarea.idGrupo}?tarea=${tarea.idTarea}`} ahora={ahora} alta conAvatar={false} />
                ))}
              </ul>
            ) : (
              <Vacio>Cuando envíes una entrega, aparecerá aquí hasta que el líder la revise.</Vacio>
            )}
          </Seccion>
        </div>

        <aside aria-label="Próximas fechas" className="flex-[1_1_300px] border-t px-4 py-5 sm:px-6 lg:max-w-[380px] lg:border-t-0 lg:border-l">
          <h2 className="mb-3 text-[13px] font-medium">Próximas fechas</h2>
          {proximas.length ? (
            <ul>
              {proximas.map((item) => (
                <li key={item.clave}>
                  <Link href={item.href} className="flex gap-3 border-b py-2.5 text-[13px] hover:text-foreground">
                    <span className="w-16 shrink-0 text-xs leading-5 text-subtle-foreground tabular-nums">
                      {item.dia}
                      <br />
                      {item.hora}
                    </span>
                    <span className="w-[3px] shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate">{item.titulo}</span>
                      <span className="mt-0.5 block truncate text-xs text-subtle-foreground">{item.tipo}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-subtle-foreground">Tus clases, evaluaciones, entregas y reuniones de los próximos 7 días aparecerán aquí.</p>
          )}
          <Link href="/calendario" className="mt-3.5 inline-block text-[13px] text-muted-foreground hover:text-foreground">Abrir calendario</Link>
        </aside>
      </div>
    </PaginaCompleta>
  );
}
