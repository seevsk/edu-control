import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { obtenerDisponibilidadGrupo } from "@/server/services/disponibilidad";
import { reunionesDelGrupoEntre } from "@/server/services/reunion";
import {
  DIAS_LARGOS,
  diaMesCorto,
  diaSemanaISO,
  etiquetaFechaLarga,
  etiquetaMinutos,
  fechaEnZonaLimaISO,
  lunesDeSemanaISO,
  minutosDelDiaLima,
  sumarDiasISO,
} from "@/lib/calendario";
import {
  bloquearReunionesParaTodos,
  diasLibresParaTodos,
  huecos,
  mapaDeDisponibilidad,
  type Franja,
  type Hueco,
} from "@/lib/disponibilidad";
import { Avatar } from "@/components/avatar";
import { IconCalendario, IconChevronDerecha, IconChevronIzquierda, IconReuniones } from "@/components/icons";
import { MapaSemanal } from "@/components/mapa-semanal";
import { Toast } from "@/components/toast";
import { TabsGrupo } from "../_components/tabs-grupo";

function nivelDeFranja(libres: number, total: number) {
  if (libres === total) return "bg-estado-completada/15 text-estado-completada";
  if (libres === 0) return "bg-border-strong/35 text-text-muted";
  return "bg-estado-revision/20 text-estado-revision";
}

function etiquetaRangoSemana(lunesISO: string) {
  const domingoISO = sumarDiasISO(lunesISO, 6);
  const anio = domingoISO.slice(0, 4);
  if (lunesISO.slice(0, 7) === domingoISO.slice(0, 7)) {
    const mes = diaMesCorto(lunesISO).split(" ")[1];
    return `${Number(lunesISO.slice(8))}–${Number(domingoISO.slice(8))} ${mes} ${anio}`;
  }
  return `${diaMesCorto(lunesISO)} – ${diaMesCorto(domingoISO)} ${anio}`;
}

export default async function HorariosGrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string; toast?: string }>;
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

  const encabezado = (
    <>
      <div>
        <Link href="/grupos" className="text-sm text-primary hover:underline">
          Grupos
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{grupo.nombre}</h1>
      </div>
      <TabsGrupo idGrupo={idGrupo} activa="horarios" mostrarConfiguracion={rolActual === "lider"} />
    </>
  );

  if (rolActual === "observador") {
    return (
      <div className="animate-page-in mx-auto flex max-w-5xl flex-col gap-6">
        {encabezado}
        <p className="text-sm text-text-muted">Los observadores no ven los horarios del grupo.</p>
      </div>
    );
  }

  const ahora = new Date();
  const hoyISO = fechaEnZonaLimaISO(ahora);
  const ahoraMin = minutosDelDiaLima(ahora);
  const { semana, toast } = await searchParams;
  const fechaSemana = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? new Date(`${semana}T12:00:00-05:00`) : null;
  const referenciaSemana = fechaSemana && !Number.isNaN(fechaSemana.getTime()) ? fechaSemana : ahora;
  const lunesActualISO = lunesDeSemanaISO(ahora);
  const lunesISO = lunesDeSemanaISO(referenciaSemana);
  const finPeriodoISO = sumarDiasISO(lunesISO, 7);
  const desdePeriodo = new Date(`${lunesISO}T00:00:00-05:00`);
  const hastaPeriodo = new Date(`${finPeriodoISO}T00:00:00-05:00`);
  const [integrantesBase, reuniones] = await Promise.all([
    obtenerDisponibilidadGrupo(sesion.idUsuario, idGrupo),
    reunionesDelGrupoEntre(sesion.idUsuario, idGrupo, desdePeriodo, hastaPeriodo),
  ]);
  const integrantes = bloquearReunionesParaTodos(integrantesBase, reuniones);
  const nombres = new Map(integrantes.map((i) => [i.idUsuario, i.nombre]));
  const total = integrantes.length;
  const mapa = mapaDeDisponibilidad(integrantes);
  const comunes = huecos(mapa);
  const casiTodos = total > 2 && comunes.length === 0 ? huecos(mapa, { toleranciaFaltantes: 1 }) : [];
  const diasLibres = diasLibresParaTodos(mapa);
  const puedeProgramar = grupo.estado === "activo";
  const fechasDias = Array.from({ length: 7 }, (_, indice) => sumarDiasISO(lunesISO, indice));
  const esSemanaActual = lunesISO === lunesActualISO;
  const primeraFechaProgramable = finPeriodoISO <= hoyISO ? null : lunesISO < hoyISO ? hoyISO : lunesISO;
  const eventosMapa = reuniones.map((reunion) => ({
    clave: `reunion-${reunion.idReunion}`,
    diaSemana: diaSemanaISO(fechaEnZonaLimaISO(reunion.inicio)),
    inicioMin: minutosDelDiaLima(reunion.inicio),
    finMin: minutosDelDiaLima(reunion.fin),
    titulo: reunion.titulo,
    subtitulo: reunion.lugar,
    href: `/reuniones?grupo=${idGrupo}#reunion-${reunion.idReunion}`,
  }));
  const sugerencias = crearSugerencias(comunes.length > 0 ? comunes : casiTodos, nombres, {
    idGrupo,
    lunesISO,
    hoyISO,
    ahoraMin,
    puedeProgramar,
  });

  const describirFranja = (franja: Franja) => {
    const libres = total - franja.ocupados.length;
    const faltan = franja.ocupados.map((idUsuario) => nombres.get(idUsuario)).filter(Boolean).join(", ");
    const disponibilidad = libres === total ? `${libres} de ${total} libres` : `${libres} de ${total} libres · no disponibles: ${faltan}`;
    return `${DIAS_LARGOS[franja.diaSemana - 1]} ${etiquetaMinutos(franja.inicioMin)} – ${etiquetaMinutos(franja.finMin)} · ${disponibilidad}`;
  };

  return (
    <div className="animate-page-in mx-auto flex max-w-5xl flex-col gap-6">
      <Toast mensaje={toast} />
      {encabezado}

      <nav aria-label="Navegar por semanas" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-semibold capitalize">{etiquetaRangoSemana(lunesISO)}</p>
        <div className="flex items-center gap-2">
          <Link
            href={`/grupos/${idGrupo}/horarios?semana=${lunesActualISO}`}
            aria-current={esSemanaActual ? "date" : undefined}
            className={`rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:bg-bg ${
              esSemanaActual ? "text-primary" : ""
            }`}
          >
            Esta semana
          </Link>
          <div className="flex overflow-hidden rounded-md border border-border-strong bg-surface">
            <Link
              href={`/grupos/${idGrupo}/horarios?semana=${sumarDiasISO(lunesISO, -7)}`}
              aria-label="Semana anterior"
              title="Semana anterior"
              className="grid size-8 place-items-center text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text"
            >
              <IconChevronIzquierda className="size-4" aria-hidden />
            </Link>
            <Link
              href={`/grupos/${idGrupo}/horarios?semana=${sumarDiasISO(lunesISO, 7)}`}
              aria-label="Semana siguiente"
              title="Semana siguiente"
              className="grid size-8 place-items-center border-l border-border-strong text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text"
            >
              <IconChevronDerecha className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </nav>

      {reuniones.length > 0 ? (
        <section aria-labelledby="titulo-reuniones-programadas">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 id="titulo-reuniones-programadas" className="text-base font-semibold">Reuniones programadas</h2>
              <p className="mt-1 text-sm text-text-muted">Estas horas ya están bloqueadas para el grupo durante la semana mostrada.</p>
            </div>
            <Link href={`/reuniones?grupo=${idGrupo}`} className="text-sm font-medium text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reuniones.map((reunion) => {
              const inicioMin = minutosDelDiaLima(reunion.inicio);
              const finMin = minutosDelDiaLima(reunion.fin);
              return (
                <li key={reunion.idReunion}>
                  <Link
                    href={`/reuniones?grupo=${idGrupo}#reunion-${reunion.idReunion}`}
                    className="block h-full rounded-md border border-cat-reunion-borde bg-cat-reunion-bg/55 p-3 transition-colors duration-150 hover:border-cat-reunion"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-cat-reunion-fg">
                      <span className="size-2 rounded-full bg-cat-reunion" aria-hidden />
                      {etiquetaFechaLarga(fechaEnZonaLimaISO(reunion.inicio))}
                    </span>
                    <span className="mt-1.5 block font-semibold text-text">{reunion.titulo}</span>
                    <span className="mt-1 block text-xs tabular-nums text-text-muted">
                      {etiquetaMinutos(inicioMin)} – {etiquetaMinutos(finMin)}
                      {reunion.lugar ? ` · ${reunion.lugar}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="titulo-sugerencias">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="titulo-sugerencias" className="text-base font-semibold">
              Mejores horarios para reunirse
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Opciones de una hora durante la semana mostrada, calculadas con los horarios semanales y las reuniones ya programadas.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-text-muted">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {integrantes.map((integrante) => (
                  <Link
                    key={integrante.idUsuario}
                    href={integrante.idUsuario === sesion.idUsuario ? "/perfil" : `/usuarios/${integrante.idUsuario}`}
                    className="rounded-full ring-2 ring-bg"
                    title={integrante.nombre}
                    aria-label={`Ver perfil de ${integrante.nombre}`}
                  >
                    <Avatar nombre={integrante.nombre} apellidos={integrante.apellidos} fotoUrl={integrante.fotoUrl} tamano="sm" />
                  </Link>
                ))}
              </div>
              <span>
                {total} {total === 1 ? "integrante" : "integrantes"}
              </span>
            </div>
            {puedeProgramar ? (
              <Link
                href={`/reuniones/nueva?grupo=${idGrupo}${primeraFechaProgramable ? `&fecha=${primeraFechaProgramable}` : ""}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1.5 font-medium text-text transition-colors duration-150 hover:border-primary hover:text-primary"
              >
                Elegir otro horario
              </Link>
            ) : null}
          </div>
        </div>

        {sugerencias.length > 0 ? (
          <ol className="grid gap-3 lg:grid-cols-3">
            {sugerencias.map((sugerencia, indice) => (
              <li key={`${sugerencia.fecha}-${sugerencia.inicio}`} className="flex min-h-44 flex-col rounded-md border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {indice + 1}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-estado-completada">
                    <span className="size-2 rounded-full bg-estado-completada" aria-hidden />
                    {sugerencia.libres}/{total} libres
                  </span>
                </div>
                <div className="mt-3">
                  <p className="font-semibold">{etiquetaFechaLarga(sugerencia.fecha)}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                    <IconCalendario className="size-4" aria-hidden />
                    <span className="tabular-nums">
                      {etiquetaMinutos(sugerencia.inicio)} – {etiquetaMinutos(sugerencia.fin)}
                    </span>
                  </p>
                  {sugerencia.faltan ? <p className="mt-1 text-xs text-estado-revision">No disponible: {sugerencia.faltan}</p> : null}
                </div>
                {sugerencia.href ? (
                  <Link
                    href={sugerencia.href}
                    className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover"
                  >
                    <IconReuniones className="size-4" aria-hidden />
                    Programar en este horario
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <div className="rounded-md border border-border bg-surface px-4 py-4 text-sm">
            <p className="font-medium">No encontramos una opción futura de una hora durante esta semana.</p>
            <p className="mt-1 text-text-muted">Puedes revisar el mapa, avanzar a otra semana o elegir otro horario y avisar al grupo.</p>
          </div>
        )}
      </section>

      {diasLibres.length > 0 ? (
        <section aria-labelledby="titulo-dias-libres">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 id="titulo-dias-libres" className="text-sm font-semibold">
              Días completamente libres
            </h2>
            <p className="text-xs text-text-muted">Sin ocupaciones entre 7:00 AM y 11:00 PM.</p>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {diasLibres.map((dia) => {
              const fechaDia = sumarDiasISO(lunesISO, dia - 1);
              const puedeProgramarDia = puedeProgramar && fechaDia >= hoyISO;
              const contenido = (
                <>
                  <span className="size-2 rounded-full bg-estado-completada" aria-hidden />
                  <span className="font-medium">{DIAS_LARGOS[dia - 1]}</span>
                  <span className="text-text-muted">{diaMesCorto(fechaDia)} · todo el rango</span>
                </>
              );
              const clase =
                "inline-flex items-center gap-2 rounded-full border border-estado-completada/25 bg-estado-completada/10 px-3 py-1.5 text-sm";

              return (
                <li key={dia}>
                  {puedeProgramarDia ? (
                    <Link
                      href={`/reuniones/nueva?grupo=${idGrupo}&fecha=${fechaDia}`}
                      className={`${clase} transition-colors duration-150 hover:border-estado-completada/60 hover:bg-estado-completada/15`}
                      title={`Programar una reunión el ${DIAS_LARGOS[dia - 1].toLowerCase()}`}
                    >
                      {contenido}
                    </Link>
                  ) : (
                    <span className={clase}>{contenido}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <MapaSemanal
        etiqueta="Disponibilidad del grupo durante la semana mostrada"
        titulo="Disponibilidad semanal"
        descripcion="Combina el patrón semanal con las reuniones programadas en estas fechas. Muestra cuántas personas están libres, nunca el motivo de sus otras ocupaciones."
        fechasDias={fechasDias}
        hoyISO={hoyISO}
        ahoraMin={ahoraMin}
        eventos={eventosMapa}
        mapa={mapa}
        claseDeFranja={(franja) => nivelDeFranja(total - franja.ocupados.length, total)}
        describirFranja={describirFranja}
        etiquetaEnFranja={(franja) => `${total - franja.ocupados.length}/${total}`}
        leyenda={[
          { clase: "bg-estado-completada/30", texto: `${total}/${total} libres` },
          { clase: "bg-estado-revision/30", texto: "Disponibilidad parcial" },
          { clase: "bg-border-strong/50", texto: `0/${total} libres` },
          ...(reuniones.length > 0 ? [{ clase: "bg-cat-reunion", texto: "Reunión programada" }] : []),
        ]}
      />
    </div>
  );
}

type SugerenciaHorario = {
  fecha: string;
  inicio: number;
  fin: number;
  libres: number;
  faltan: string | null;
  href: string | null;
};

function hhmm(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function crearSugerencias(
  huecosDisponibles: Hueco[],
  nombres: Map<number, string>,
  opciones: { idGrupo: number; lunesISO: string; hoyISO: string; ahoraMin: number; puedeProgramar: boolean },
): SugerenciaHorario[] {
  const candidatas = huecosDisponibles
    .map((hueco): SugerenciaHorario | null => {
      const fecha = sumarDiasISO(opciones.lunesISO, hueco.diaSemana - 1);
      if (fecha < opciones.hoyISO) return null;

      const siguienteMediaHora = Math.ceil((opciones.ahoraMin + 1) / 30) * 30;
      const inicio = fecha === opciones.hoyISO ? Math.max(hueco.inicioMin, siguienteMediaHora) : hueco.inicioMin;
      const fin = inicio + 60;
      if (fin > hueco.finMin) return null;

      const faltan = hueco.faltan.map((id) => nombres.get(id)).filter(Boolean).join(", ") || null;
      return {
        fecha,
        inicio,
        fin,
        libres: nombres.size - hueco.faltan.length,
        faltan,
        href: opciones.puedeProgramar
          ? `/reuniones/nueva?grupo=${opciones.idGrupo}&fecha=${fecha}&inicio=${hhmm(inicio)}&fin=${hhmm(fin)}`
          : null,
      };
    })
    .filter((sugerencia): sugerencia is SugerenciaHorario => sugerencia !== null)
    .sort((a, b) => `${a.fecha}-${hhmm(a.inicio)}`.localeCompare(`${b.fecha}-${hhmm(b.inicio)}`));

  const elegidas: SugerenciaHorario[] = [];
  const fechasElegidas = new Set<string>();
  for (const sugerencia of candidatas) {
    if (fechasElegidas.has(sugerencia.fecha)) continue;
    elegidas.push(sugerencia);
    fechasElegidas.add(sugerencia.fecha);
    if (elegidas.length === 3) return elegidas;
  }

  for (const sugerencia of candidatas) {
    if (elegidas.includes(sugerencia)) continue;
    elegidas.push(sugerencia);
    if (elegidas.length === 3) break;
  }

  return elegidas;
}
