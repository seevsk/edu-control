import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { obtenerDisponibilidadGrupo } from "@/server/services/disponibilidad";
import { DIAS_CORTOS, DIAS_LARGOS, etiquetaHoraEje, etiquetaMinutos, formatearDuracion } from "@/lib/calendario";
import {
  VENTANA_POR_DEFECTO,
  diasLibresParaTodos,
  huecos,
  mapaDeDisponibilidad,
  type Franja,
  type Hueco,
} from "@/lib/disponibilidad";
import { Avatar } from "@/components/avatar";
import { TabsGrupo } from "../_components/tabs-grupo";

const PX_FRANJA = 14;

function nivelDeFranja(libres: number, total: number) {
  if (libres === total) return "bg-estado-completada";
  if (libres / total >= 0.5) return "bg-estado-completada/45";
  if (libres > 0) return "bg-estado-completada/15";
  return "bg-border";
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
      <TabsGrupo idGrupo={idGrupo} activa="horarios" />
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
  const comunesSinDiasLibres = comunes.filter((hueco) => !diasLibres.includes(hueco.diaSemana));

  const { desdeMin, hastaMin, pasoMin } = VENTANA_POR_DEFECTO;
  const horas = Array.from({ length: (hastaMin - desdeMin) / 60 }, (_, i) => desdeMin / 60 + i);
  const altoGrid = ((hastaMin - desdeMin) / pasoMin) * PX_FRANJA;

  const describirFranja = (franja: Franja) => {
    const libres = total - franja.ocupados.length;
    const faltan = franja.ocupados.map((idUsuario) => nombres.get(idUsuario)).join(", ");
    return `${DIAS_LARGOS[franja.diaSemana - 1]} ${etiquetaMinutos(franja.inicioMin)} – ${etiquetaMinutos(franja.finMin)} · ${
      libres === total ? "todos libres" : `${libres} de ${total} libres · falta ${faltan}`
    }`;
  };

  return (
    <div className="animate-page-in mx-auto flex max-w-5xl flex-col gap-6">
      {encabezado}

      <section className="flex flex-col gap-3" aria-labelledby="titulo-huecos">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-huecos" className="text-base font-semibold">
            Huecos en común
          </h2>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <div className="flex -space-x-1.5">
              {integrantes.map((integrante) => (
                <span key={integrante.idUsuario} className="rounded-full ring-2 ring-bg" title={integrante.nombre}>
                  <Avatar nombre={integrante.nombre} apellidos={integrante.apellidos} fotoUrl={integrante.fotoUrl} tamano="sm" />
                </span>
              ))}
            </div>
            {total} {total === 1 ? "integrante" : "integrantes"}
          </div>
        </div>

        {diasLibres.length > 0 ? (
          <ListaHuecos
            titulo="Todo el día"
            elementos={diasLibres.map((dia) => ({ clave: `d-${dia}`, dia: DIAS_LARGOS[dia - 1], horario: null, faltan: null }))}
          />
        ) : null}

        {comunesSinDiasLibres.length > 0 ? (
          <ListaHuecos titulo="Todos libres" elementos={comunesSinDiasLibres.map((h) => aElemento(h, nombres))} />
        ) : null}

        {casiTodos.length > 0 ? (
          <ListaHuecos titulo="Falta una persona" elementos={casiTodos.map((h) => aElemento(h, nombres))} />
        ) : null}

        {diasLibres.length === 0 && comunes.length === 0 && casiTodos.length === 0 ? (
          <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-text-muted">
            Sin huecos de 1 h con todos libres esta semana.
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-surface" aria-label="Disponibilidad semanal del grupo">
        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-border">
          <div />
          {DIAS_CORTOS.map((dia) => (
            <p key={dia} className="border-l border-border py-2 text-center text-[11px] font-medium uppercase tracking-wide text-text-muted">
              {dia}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
          <div className="relative" style={{ height: altoGrid }} aria-hidden>
            {horas.map((hora, i) => (
              <span
                key={hora}
                className={`absolute right-2 text-[10px] tabular-nums text-text-muted ${i === 0 ? "top-0.5" : "-translate-y-1/2"}`}
                style={i === 0 ? undefined : { top: i * (60 / pasoMin) * PX_FRANJA }}
              >
                {etiquetaHoraEje(hora)}
              </span>
            ))}
          </div>

          {mapa.map((franjas, i) => (
            <div key={DIAS_CORTOS[i]} className="flex flex-col gap-px border-l border-border p-px" style={{ height: altoGrid }}>
              {franjas.map((franja) => (
                <div
                  key={franja.inicioMin}
                  className={`flex-1 rounded-[2px] ${nivelDeFranja(total - franja.ocupados.length, total)}`}
                  title={describirFranja(franja)}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-3 py-2.5 text-xs text-text-muted">
          {[
            { clase: "bg-estado-completada", texto: "Todos libres" },
            { clase: "bg-estado-completada/45", texto: "La mayoría" },
            { clase: "bg-estado-completada/15", texto: "Algunos" },
            { clase: "bg-border", texto: "Nadie" },
          ].map((nivel) => (
            <span key={nivel.texto} className="flex items-center gap-1.5">
              <span className={`size-3 rounded-[2px] ${nivel.clase}`} aria-hidden />
              {nivel.texto}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

type ElementoHueco = { clave: string; dia: string; horario: string | null; faltan: string | null };

function aElemento(hueco: Hueco, nombres: Map<number, string>): ElementoHueco {
  return {
    clave: `${hueco.diaSemana}-${hueco.inicioMin}`,
    dia: DIAS_LARGOS[hueco.diaSemana - 1],
    horario: `${etiquetaMinutos(hueco.inicioMin)} – ${etiquetaMinutos(hueco.finMin)} · ${formatearDuracion(hueco.finMin - hueco.inicioMin)}`,
    faltan: hueco.faltan.length > 0 ? hueco.faltan.map((id) => nombres.get(id)).join(", ") : null,
  };
}

/** Una fila por dia con sus franjas, para que una semana con muchos huecos se lea de un vistazo. */
function ListaHuecos({ titulo, elementos }: { titulo: string; elementos: ElementoHueco[] }) {
  const porDia = new Map<string, ElementoHueco[]>();
  for (const elemento of elementos) porDia.set(elemento.dia, [...(porDia.get(elemento.dia) ?? []), elemento]);

  return (
    <div className="rounded-md border border-border bg-surface">
      <h3 className="border-b border-border px-4 py-2 text-xs font-medium text-text-muted">{titulo}</h3>
      <ul className="divide-y divide-border">
        {[...porDia].map(([dia, delDia]) => (
          <li key={dia} className="flex flex-col gap-1.5 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-4">
            <span className="w-24 shrink-0 font-medium">{dia}</span>
            <span className="flex flex-wrap gap-1.5">
              {delDia.map((elemento) =>
                elemento.horario ? (
                  <span
                    key={elemento.clave}
                    className="rounded-sm bg-estado-completada/12 px-2 py-0.5 tabular-nums text-text"
                  >
                    {elemento.horario}
                    {elemento.faltan ? <span className="text-text-muted"> · falta {elemento.faltan}</span> : null}
                  </span>
                ) : null,
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
