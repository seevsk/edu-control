import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { obtenerDisponibilidadGrupo } from "@/server/services/disponibilidad";
import {
  DIAS_LARGOS,
  etiquetaFechaLarga,
  etiquetaMinutos,
  fechaEnZonaLimaISO,
  minutosDelDiaLima,
  proximaFechaDelDia,
  sumarDiasISO,
} from "@/lib/calendario";
import { diasLibresParaTodos, huecos, mapaDeDisponibilidad, type Franja, type Hueco } from "@/lib/disponibilidad";
import { Avatar } from "@/components/avatar";
import { IconCalendario, IconReuniones } from "@/components/icons";
import { MapaSemanal } from "@/components/mapa-semanal";
import { TabsGrupo } from "../_components/tabs-grupo";

function nivelDeFranja(libres: number, total: number) {
  if (libres === total) return "bg-estado-completada text-white";
  if (libres === 0) return "bg-border-strong/65 text-text-muted";
  return "bg-estado-revision/55 text-text";
}

export default async function HorariosGrupoPage({ params }: { params: Promise<{ id: string }> }) {
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

  const integrantes = await obtenerDisponibilidadGrupo(sesion.idUsuario, idGrupo);
  const nombres = new Map(integrantes.map((i) => [i.idUsuario, i.nombre]));
  const total = integrantes.length;
  const mapa = mapaDeDisponibilidad(integrantes);
  const comunes = huecos(mapa);
  const casiTodos = total > 2 && comunes.length === 0 ? huecos(mapa, { toleranciaFaltantes: 1 }) : [];
  const diasLibres = diasLibresParaTodos(mapa);
  const ahora = new Date();
  const hoyISO = fechaEnZonaLimaISO(ahora);
  const puedeProgramar = grupo.estado === "activo";
  const sugerencias = crearSugerencias(comunes.length > 0 ? comunes : casiTodos, nombres, {
    idGrupo,
    hoyISO,
    ahoraMin: minutosDelDiaLima(ahora),
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
      {encabezado}

      <section className="flex flex-col gap-3" aria-labelledby="titulo-sugerencias">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="titulo-sugerencias" className="text-base font-semibold">
              Mejores horarios para reunirse
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Opciones de una hora durante los próximos 7 días, calculadas con los horarios semanales del grupo.
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
                href={`/reuniones/nueva?grupo=${idGrupo}`}
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
            <p className="font-medium">No encontramos una opción de una hora para los próximos 7 días.</p>
            <p className="mt-1 text-text-muted">Puedes revisar el mapa completo o elegir otro horario y avisar al grupo.</p>
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
              const contenido = (
                <>
                  <span className="size-2 rounded-full bg-estado-completada" aria-hidden />
                  <span className="font-medium">{DIAS_LARGOS[dia - 1]}</span>
                  <span className="text-text-muted">Todo el rango</span>
                </>
              );
              const clase =
                "inline-flex items-center gap-2 rounded-full border border-estado-completada/25 bg-estado-completada/10 px-3 py-1.5 text-sm";

              return (
                <li key={dia}>
                  {puedeProgramar ? (
                    <Link
                      href={`/reuniones/nueva?grupo=${idGrupo}&fecha=${proximaFechaDelDia(hoyISO, dia)}`}
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
        etiqueta="Disponibilidad semanal del grupo"
        titulo="Mapa semanal completo"
        descripcion="Este es un patrón que se repite cada semana. Muestra cuántas personas están libres, nunca el motivo de su ocupación."
        mapa={mapa}
        claseDeFranja={(franja) => nivelDeFranja(total - franja.ocupados.length, total)}
        describirFranja={describirFranja}
        etiquetaEnFranja={(franja) => `${total - franja.ocupados.length}/${total}`}
        leyenda={[
          { clase: "bg-estado-completada", texto: `${total}/${total} libres` },
          { clase: "bg-estado-revision/55", texto: "Disponibilidad parcial" },
          { clase: "bg-border-strong/65", texto: `0/${total} libres` },
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
  opciones: { idGrupo: number; hoyISO: string; ahoraMin: number; puedeProgramar: boolean },
): SugerenciaHorario[] {
  const ultimoDiaISO = sumarDiasISO(opciones.hoyISO, 6);
  const candidatas = huecosDisponibles
    .map((hueco): SugerenciaHorario | null => {
      const fecha = proximaFechaDelDia(opciones.hoyISO, hueco.diaSemana);
      if (fecha > ultimoDiaISO) return null;

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
