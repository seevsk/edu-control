"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarPlus, CircleAlert, Clock, Link2, MapPin, RotateCw, Video } from "lucide-react";
import { DIAS_CORTOS, OPCIONES_HORA, diaSemanaISO } from "@/lib/calendario";
import { fechaCorta, formatoHora } from "@/lib/formato-fecha";
import { cn } from "@/lib/utils";
import type { Intervalo } from "@/lib/disponibilidad";
import { SubmitButton } from "@/components/submit-button";
import { Switch } from "@/components/ui/switch";
import { FilaDesplazable } from "@/components/ui-app/fila-desplazable";
import { crearReunionAction } from "../actions";

export type Sugerencia = { fecha: string; inicio: string; fin: string; etiqueta: string; faltan: string | null };
type ReunionProgramada = { titulo: string; fecha: string; inicioMin: number; finMin: number };

const CAMPO =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-sm outline-none placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 max-md:h-11 max-md:text-base";
const ETIQUETA = "mb-1.5 block text-[13px] font-medium";

function aMinutos(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "Hoy 6:00pm", "Dom 22 10:00am": etiqueta corta de un hueco para los chips móviles. */
function etiquetaChip(fecha: string, inicio: string, hoyISO: string) {
  const dia = fechaCorta(new Date(`${fecha}T12:00:00-05:00`), { ahora: new Date(`${hoyISO}T12:00:00-05:00`) });
  const [h, m] = inicio.split(":").map(Number);
  return `${dia} ${formatoHora(h, m)}`;
}

/** "Mañana · Sáb 21": relativo a hoy más el día de la semana y el número. */
function fechaNatural(fecha: string, hoyISO: string) {
  if (!fecha) return "";
  const corta = fechaCorta(new Date(`${fecha}T12:00:00-05:00`), { ahora: new Date(`${hoyISO}T12:00:00-05:00`) });
  if (corta === "Hoy" || corta === "Mañana" || corta === "Ayer") return `${corta} · ${DIAS_CORTOS[diaSemanaISO(fecha) - 1]} ${Number(fecha.slice(8))}`;
  return corta;
}

function ConIcono({ icono, children }: { icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle-foreground [&_svg]:size-[15px]" aria-hidden>
        {icono}
      </span>
      {children}
    </div>
  );
}

/**
 * Sugiere los huecos en comun, pero no obliga a usarlos: si la hora elegida pisa el horario de
 * alguien solo se avisa (el grupo puede decidir reunirse igual). Con "Videollamada en EduControl"
 * activada (por defecto) el enlace se oculta; si la sala no se pudo crear, se ofrece reintentar o
 * usar un enlace propio conservando lo escrito.
 */
export function FormularioReunion({
  grupos,
  idGrupo,
  hoyISO,
  integrantes,
  reunionesProgramadas,
  sugerencias,
  iniciales,
  errorSala = false,
  modoHoja = false,
  mensajeError = null,
}: {
  grupos: { idGrupo: number; nombre: string }[];
  idGrupo: number | null;
  hoyISO: string;
  integrantes: { idUsuario: number; nombre: string; ocupados: Intervalo[] }[];
  reunionesProgramadas: ReunionProgramada[];
  sugerencias: Sugerencia[];
  iniciales: { fecha: string; inicio: string; fin: string; titulo: string; lugar: string };
  errorSala?: boolean;
  /** Hoja inferior móvil sobre el grupo: sin selector de grupo, chips en fila, fecha natural y botón fijo abajo. */
  modoHoja?: boolean;
  mensajeError?: string | null;
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState(iniciales.fecha);
  const [inicio, setInicio] = useState(iniciales.inicio);
  const [fin, setFin] = useState(iniciales.fin);
  const [videollamada, setVideollamada] = useState(true);
  const [mostrarErrorSala, setMostrarErrorSala] = useState(errorSala);
  // "Usar un enlace propio" apaga el interruptor y enfoca el campo apenas aparece.
  const enfocarEnlace = useRef(false);

  const finAntesDeInicio = aMinutos(fin) <= aMinutos(inicio);
  let chocan: string[] | null = null;
  let reunionesQueChocan: string[] | null = null;
  if (idGrupo && fecha && !finAntesDeInicio) {
    const base = (diaSemanaISO(fecha) - 1) * 24 * 60;
    const desde = base + aMinutos(inicio);
    const hasta = base + aMinutos(fin);
    chocan = integrantes
      .filter((i) => i.ocupados.some(([a, b]) => a < hasta && b > desde))
      .map((i) => i.nombre);
    reunionesQueChocan = reunionesProgramadas
      .filter((reunion) => reunion.fecha === fecha && reunion.inicioMin < aMinutos(fin) && reunion.finMin > aMinutos(inicio))
      .map((reunion) => reunion.titulo);
  }

  return (
    <form action={crearReunionAction} className={cn("flex flex-col gap-[18px]", modoHoja && "min-h-0 flex-1 gap-0")}>
      {modoHoja ? (
        <>
          <input type="hidden" name="idGrupo" value={idGrupo ?? ""} />
          <input type="hidden" name="origen" value="hoja" />
        </>
      ) : null}
      <label className={cn("block", modoHoja && "hidden")}>
        <span className={ETIQUETA}>Grupo</span>
        <select
          name="idGrupo"
          required
          value={idGrupo ?? ""}
          onChange={(e) => router.push(`/reuniones/nueva?grupo=${e.target.value}`)}
          className={CAMPO}
        >
          {idGrupo === null ? <option value="">Elige un grupo</option> : null}
          {grupos.map((grupo) => (
            <option key={grupo.idGrupo} value={grupo.idGrupo}>
              {grupo.nombre}
            </option>
          ))}
        </select>
      </label>

      {idGrupo ? (
        <>
          <div className={cn(modoHoja ? "flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto overscroll-contain px-4 pt-1 pb-4" : "contents")}>
          {modoHoja && mensajeError ? (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {mensajeError}
            </p>
          ) : null}
          {sugerencias.length > 0 ? (
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium">Huecos en común</legend>
              <FilaDesplazable className={modoHoja ? "-mx-4" : "contents"} scrollerClassName={cn("flex gap-1.5", modoHoja ? "px-4 pb-0.5" : "flex-wrap overflow-visible")} fadeClassName={modoHoja ? undefined : "hidden"}>
                {sugerencias.map((s) => {
                  const elegida = s.fecha === fecha && s.inicio === inicio && s.fin === fin;
                  return (
                    <button
                      key={`${s.fecha}-${s.inicio}`}
                      type="button"
                      aria-pressed={elegida}
                      onClick={() => {
                        setFecha(s.fecha);
                        setInicio(s.inicio);
                        setFin(s.fin);
                      }}
                      className={cn(
                        "inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-[13px] tabular-nums whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-md:h-9 max-md:px-3.5", modoHoja && "max-md:px-2.5",
                        elegida ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {modoHoja ? etiquetaChip(s.fecha, s.inicio, hoyISO) : s.etiqueta}
                      {s.faltan && !modoHoja ? <span className="ml-1.5 text-xs opacity-70">· falta {s.faltan}</span> : null}
                    </button>
                  );
                })}
              </FilaDesplazable>
            </fieldset>
          ) : null}

          <label className="block">
            <span className={ETIQUETA}>Título</span>
            <input name="titulo" required maxLength={120} defaultValue={iniciales.titulo} placeholder="Ej. Avance del informe" className={CAMPO} />
          </label>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
            <label className="col-span-2 block md:col-span-1">
              <span className={ETIQUETA}>Fecha</span>
              <ConIcono icono={<CalendarDays />}>
                {modoHoja ? (
                  <div className="relative">
                    <div className={cn(CAMPO, "flex items-center pl-9", !fecha && "text-subtle-foreground")} aria-hidden>
                      {fecha ? fechaNatural(fecha, hoyISO) : "Elige una fecha"}
                    </div>
                    <input
                      type="date"
                      name="fecha"
                      required
                      min={hoyISO}
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {
                          // Sin showPicker el propio campo transparente abre el selector al tocarlo.
                        }
                      }}
                      aria-label="Fecha"
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                  </div>
                ) : (
                  <input type="date" name="fecha" required min={hoyISO} value={fecha} onChange={(e) => setFecha(e.target.value)} className={cn(CAMPO, "pl-9")} />
                )}
              </ConIcono>
            </label>
            <label className="block">
              <span className={ETIQUETA}>Desde</span>
              <ConIcono icono={<Clock />}>
                <select name="horaInicio" value={inicio} onChange={(e) => setInicio(e.target.value)} required className={cn(CAMPO, "pl-9 tabular-nums")}>
                  {OPCIONES_HORA.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </select>
              </ConIcono>
            </label>
            <label className="block">
              <span className={ETIQUETA}>Hasta</span>
              <ConIcono icono={<Clock />}>
                <select name="horaFin" value={fin} onChange={(e) => setFin(e.target.value)} required className={cn(CAMPO, "pl-9 tabular-nums")}>
                  {OPCIONES_HORA.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </select>
              </ConIcono>
            </label>
          </div>

          {finAntesDeInicio ? (
            <p role="alert" className="text-[13px] text-destructive">
              La hora de fin debe ser después de la de inicio.
            </p>
          ) : chocan === null || reunionesQueChocan === null ? null : chocan.length === 0 && reunionesQueChocan.length === 0 ? (
            <p aria-live="polite" className="flex items-center gap-1.5 text-[13px] text-estado-completada">
              <span className="size-2 rounded-full bg-estado-completada" aria-hidden />
              Todos libres
            </p>
          ) : (
            <div aria-live="polite" className="flex items-start gap-2 rounded-lg bg-cat-laboral-bg px-3 py-2 text-[13px] text-cat-laboral-fg">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cat-laboral" aria-hidden />
              <span>
                {reunionesQueChocan.length > 0 ? (
                  <span className="block">Coincide con {reunionesQueChocan.length === 1 ? "la reunión" : "las reuniones"} {reunionesQueChocan.map((titulo) => `“${titulo}”`).join(", ")}.</span>
                ) : null}
                {chocan.length > 0 ? <span className="block">Choca con el horario de {chocan.join(", ")}.</span> : null}
              </span>
            </div>
          )}

          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border border-cat-reunion/30 bg-cat-reunion-bg px-3.5 max-md:min-h-14">
            <Video className="size-[18px] shrink-0 text-cat-reunion-fg" aria-hidden />
            <span className="flex-1 text-sm font-medium">Videollamada en EduControl</span>
            <Switch
              name="videollamada"
              checked={videollamada}
              onCheckedChange={(valor) => {
                setVideollamada(valor);
                if (valor) setMostrarErrorSala(false);
              }}
              aria-label="Videollamada en EduControl"
            />
          </label>

          {mostrarErrorSala && videollamada ? (
            <div role="alert" className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px]">
              <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
              <span className="min-w-40 flex-1">No se pudo crear la videollamada.</span>
              <span className="flex flex-wrap gap-1.5">
                <button type="submit" className="inline-flex h-[30px] items-center gap-1.5 rounded-md border border-input px-3 hover:bg-muted max-md:h-11">
                  <RotateCw className="size-3.5" aria-hidden />
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVideollamada(false);
                    setMostrarErrorSala(false);
                    enfocarEnlace.current = true;
                  }}
                  className="inline-flex h-[30px] items-center gap-1.5 rounded-md border border-input px-3 hover:bg-muted max-md:h-11"
                >
                  <Link2 className="size-3.5" aria-hidden />
                  Usar un enlace propio
                </button>
              </span>
            </div>
          ) : null}

          <label className="block">
            <span className={ETIQUETA}>
              Lugar <span className="font-normal text-subtle-foreground">· opcional</span>
            </span>
            <ConIcono icono={<MapPin />}>
              <input name="lugar" maxLength={160} defaultValue={iniciales.lugar} placeholder="Ej. Lab 304" className={cn(CAMPO, "pl-9")} />
            </ConIcono>
          </label>

          {videollamada ? null : (
            <label className="block">
              <span className={ETIQUETA}>
                Enlace <span className="font-normal text-subtle-foreground">· opcional</span>
              </span>
              <ConIcono icono={<Link2 />}>
                <input
                  ref={(campo) => {
                    if (campo && enfocarEnlace.current) {
                      enfocarEnlace.current = false;
                      campo.focus();
                    }
                  }}
                  name="enlace" type="url" placeholder="https://meet.google.com/..." className={cn(CAMPO, "pl-9")} />
              </ConIcono>
            </label>
          )}

          </div>

          {modoHoja ? (
            <div className="border-t px-4 pt-3 pb-[max(1.875rem,env(safe-area-inset-bottom))]">
              <SubmitButton
                pendingText="Programando…"
                className="h-[50px] w-full justify-center rounded-xl border border-primary bg-primary text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <CalendarPlus className="size-[18px]" aria-hidden />
                Programar reunión
              </SubmitButton>
            </div>
          ) : (
          <div className="mt-2.5 flex justify-end gap-2 max-md:flex-col-reverse">
            <Link
              href={`/grupos/${idGrupo}/reuniones`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-[13px] hover:bg-muted max-md:h-[50px] max-md:rounded-xl max-md:text-[15px]"
            >
              Cancelar
            </Link>
            <SubmitButton
              pendingText="Programando…"
              className="h-9 justify-center rounded-md border border-primary bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 max-md:h-[50px] max-md:rounded-xl max-md:text-[15px] max-md:font-semibold"
            >
              <CalendarPlus className="size-3.5" aria-hidden />
              Programar reunión
            </SubmitButton>
          </div>
          )}
        </>
      ) : null}
    </form>
  );
}
