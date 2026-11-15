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
import { PaginaCompleta, PageHeader } from "@/components/ui-app/page-header";
import { TaskRow, type FilaTarea } from "@/components/ui-app/task-row";
import { CourseDot } from "@/components/ui-app/course-dot";
import { Toast } from "@/components/toast";
import { Button } from "@/components/ui/button";

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
      <h2 className="flex h-10 items-center gap-2 border-b bg-muted px-4 text-[13px] font-medium sm:px-8">
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
  const [mias, porRevisar, cursos, grupos, invitaciones, agenda] = await Promise.all([
    listarTareasAsignadasAlUsuario(sesion.idUsuario, 50),
    listarTareasPorRevisar(sesion.idUsuario),
    listarCursos(sesion.idUsuario),
    listarMisGrupos(sesion.idUsuario),
    listarInvitacionesPendientes(sesion.idUsuario),
    obtenerCalendarioEntre(sesion.idUsuario, hoyISO, sumarDiasISO(hoyISO, DIAS_AGENDA)),
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
        tipo: `Clase · ${horario.curso.modalidad === "presencial" ? "presencial" : "remota"}`,
        color: colorCurso(horario.curso.idCurso),
        href: `/cursos/${horario.curso.idCurso}`,
      });
    }
  }
  for (const evaluacion of agenda.evaluaciones) {
    if (evaluacion.fechaCierre < ahora) continue;
    items.push({
      clave: `evaluacion-${evaluacion.idEvaluacion}`,
      orden: evaluacion.fechaCierre.getTime(),
      dia: etiquetaDia(fechaEnZonaLimaISO(evaluacion.fechaCierre)),
      hora: horaLima(evaluacion.fechaCierre),
      titulo: evaluacion.nombre,
      tipo: `Evaluación · ${aOracion(evaluacion.curso.nombre)}`,
      color: colorCurso(evaluacion.curso.idCurso),
      href: `/cursos/${evaluacion.curso.idCurso}`,
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
  const sinCursos = cursos.length === 0;
  const sinGrupos = grupos.length === 0;

  return (
    <PaginaCompleta>
      <Toast mensaje={toast} />
      <PageHeader
        titulo="Tu trabajo"
        contexto={<span>{etiquetaFechaLarga(hoyISO)}{resumen.length ? ` · ${resumen.join(" y ")}` : " · nada urgente por ahora"}</span>}
      />
      <div className="flex flex-1 flex-wrap">
        <div className="min-w-0 flex-[999_1_480px]">
          {sinCursos || sinGrupos ? (
            <Seccion titulo="Para empezar" cantidad={Number(sinCursos) + Number(sinGrupos)}>
              <ul>
                {sinCursos ? (
                  <li className="flex min-h-[52px] items-center justify-between gap-3 border-b px-4 text-[13px] sm:px-8">
                    Registra tus cursos con su horario para ver tus clases y evaluaciones aquí.
                    <Button variant="outline" size="sm" asChild><Link href="/cursos?nuevo=1">Agregar curso</Link></Button>
                  </li>
                ) : null}
                {sinGrupos ? (
                  <li className="flex min-h-[52px] items-center justify-between gap-3 border-b px-4 text-[13px] sm:px-8">
                    {invitaciones.length ? "Te invitaron a un grupo: acéptalo para ver sus tareas." : "Crea un grupo para tu trabajo en equipo e invita a tus compañeros."}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={invitaciones.length ? "/invitaciones" : "/grupos?nuevo=1"}>{invitaciones.length ? "Ver invitación" : "Crear grupo"}</Link>
                    </Button>
                  </li>
                ) : null}
              </ul>
            </Seccion>
          ) : null}

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
                      className="flex min-h-[52px] items-center gap-3 border-b px-4 py-2 text-[13px] hover:bg-accent sm:px-8"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate">{tarea.titulo}</span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-subtle-foreground">
                          {detalleGrupo(tarea.grupo)}
                          {tarea.asignado ? ` · ${nombreCorto(tarea.asignado.nombre, tarea.asignado.apellidos)} la terminó` : ""}
                          {tarea.fechaTerminada ? ` el ${diaMesCorto(fechaEnZonaLimaISO(tarea.fechaTerminada))}` : ""}
                        </span>
                      </span>
                      <span className="inline-flex h-7 shrink-0 items-center rounded-md border border-input px-2.5 text-[13px]">Revisar</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio>Cuando un compañero termine una tarea, aparecerá aquí para que la apruebes o la devuelvas.</Vacio>
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
              <Vacio>Cuando termines una tarea y pase a revisión, aparecerá aquí hasta que un compañero la confirme.</Vacio>
            )}
          </Seccion>
        </div>

        <aside aria-label="Próximas fechas" className="flex-[1_1_300px] border-l px-4 py-5 sm:px-6 lg:max-w-[380px]">
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
