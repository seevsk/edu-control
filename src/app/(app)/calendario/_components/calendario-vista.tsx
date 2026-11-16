"use client";

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { es } from "date-fns/locale";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Repeat,
  Tag,
  Users,
  X,
} from "lucide-react";
import {
  EventCalendar,
  useEventCalendar,
  useEventCalendarNavigation,
  useEventCalendarView,
  type EventCalendarApi,
} from "@/components/reui/event-calendar/event-calendar";
import { EventCalendarContent } from "@/components/reui/event-calendar/event-calendar-content";
import type { CalendarView, EventCalendarOccurrence, EventCalendarSlotDraft } from "@/components/reui/event-calendar/event-calendar-types";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { diaSemanaISO, diasDeVistaMes, fechaEnZonaLimaISO, minutosDelDiaLima, sumarDiasISO, sumarMesesISO } from "@/lib/calendario";
import { duracionMinutos, formatoHora, rangoHoras } from "@/lib/formato-fecha";
import { cn } from "@/lib/utils";
import type { EventoCalendario } from "./eventos";
import { FILTROS_FECHAS, FILTROS_HORARIO, type DatoEvento, type FiltroCalendario, type IconoLinea, type ModoCalendario } from "./tipos-calendario";
import { NuevoTiempoOcupado, type BorradorTiempo } from "./nuevo-tiempo-ocupado";

const ZONA = "America/Lima";
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
const VISTA_DE_MODO: Record<ModoCalendario, CalendarView> = { mes: "month", semana: "week", agenda: "agenda" };
const MODO_DE_VISTA: Partial<Record<CalendarView, ModoCalendario>> = { month: "mes", week: "semana", agenda: "agenda" };
const ICONOS: Record<IconoLinea, typeof Clock> = { hora: Clock, repite: Repeat, lugar: MapPin, evaluacion: BookOpen, grupo: Users, estado: Tag };
const ID_BORRADOR = "__nuevo";
/** Disponibilidad de un compañero: familiar y personal se muestran juntos, sin detalle (AGENTS.md 8.2). */
const FILTROS_COMPANERO = FILTROS_HORARIO.filter((filtro) => filtro.clave !== "personal").map((filtro) =>
  filtro.clave === "familiar" ? { ...filtro, texto: "Familiar / Personal" } : filtro,
);
const COLOR_TIPO = { laboral: "var(--cat-laboral)", familiar: "var(--cat-fam)", personal: "var(--cal-personal)" } as const;

const minutosAPartes = (minutos: number) => ({ horas: Math.floor(minutos / 60), minutos: minutos % 60 });

const I18N = {
  labels: {
    today: "Hoy",
    previous: "Anterior",
    next: "Siguiente",
    addEvent: "Agregar",
    allDay: "Entregas",
    more: (n: number) => `+${n} más`,
    noEvents: "Nada programado",
    loading: "Cargando",
    event: "evento",
    events: (n: number) => (n === 1 ? "1 evento" : `${n} eventos`),
    selectView: "Vista",
    goToDate: "Ir a la fecha",
    dropNotAllowed: "No se puede mover",
    continues: "continúa",
    timeFrom: (hora: string) => `Desde ${hora}`,
    timeUntil: (hora: string) => `Hasta ${hora}`,
    toggleDayEvents: (n: number) => (n === 1 ? "1 evento" : `${n} eventos`),
    moreCompact: (n: number) => `+${n}`,
    timeRange: (desde: string, hasta: string) => `${desde} - ${hasta}`,
  },
  viewNames: { month: "Mes", week: "Semana", day: "Día", agenda: "Agenda" },
  formats: {
    monthTitle: "MMMM yyyy",
    monthDayHeader: "EEE",
    monthDayHeaderNarrow: "EEEEE",
    agendaDayHeader: "EEEE d 'de' MMMM",
    moreDayHeader: "EEEE d 'de' MMMM",
    agendaWeekday: "EEE",
    timeGutter: "h:mmaaa",
    timeGutterMinute: "h:mmaaa",
    eventTime: "h:mmaaa",
  },
  functions: {
    formatEventTime: (inicio: Date, fin: Date, todoElDia: boolean) =>
      todoElDia ? "" : rangoHoras(minutosAPartes(minutosDelDiaLima(inicio)), minutosAPartes(minutosDelDiaLima(fin) || 1440)),
  },
};

/** Título de la barra: "9 – 15 nov 2026", "30 nov – 6 dic 2026" o "noviembre 2026". */
function tituloPeriodo(modo: ModoCalendario | undefined, inicio: Date, fin: Date) {
  const desde = fechaEnZonaLimaISO(inicio);
  const hasta = fechaEnZonaLimaISO(new Date(fin.getTime() - 1));
  const [anioA, mesA, diaA] = desde.split("-").map(Number);
  const [anioB, mesB, diaB] = hasta.split("-").map(Number);
  if (modo === "mes") return `${MESES_LARGOS[mesA - 1]} ${anioA}`;
  if (anioA !== anioB) return `${diaA} ${MESES[mesA - 1]} ${anioA} – ${diaB} ${MESES[mesB - 1]} ${anioB}`;
  if (mesA !== mesB) return `${diaA} ${MESES[mesA - 1]} – ${diaB} ${MESES[mesB - 1]} ${anioB}`;
  return `${diaA} – ${diaB} ${MESES[mesB - 1]} ${anioB}`;
}

interface DetalleAbierto {
  occurrence: EventCalendarOccurrence<DatoEvento>;
  rect: { left: number; top: number; width: number; height: number };
}

export function CalendarioVista({
  eventos,
  minutos,
  modo,
  fecha,
  hoyISO,
  rutaBase = "/calendario",
  soloLectura = false,
}: {
  eventos: EventoCalendario[];
  minutos: Partial<Record<FiltroCalendario, number>>;
  modo: ModoCalendario;
  fecha: string;
  hoyISO: string;
  /** Ruta que se actualiza al navegar (la disponibilidad de un compañero usa la suya). */
  rutaBase?: string;
  /** Horario de otra persona: sin crear tiempo ocupado ni filtros de fechas. */
  soloLectura?: boolean;
}) {
  const router = useRouter();
  const apiRef = useRef<EventCalendarApi<DatoEvento> | null>(null);
  const ultimoPuntero = useRef({ x: 0, y: 0 });
  const [ocultos, setOcultos] = useState<FiltroCalendario[]>([]);
  const [detalle, setDetalle] = useState<DetalleAbierto | null>(null);
  const [borrador, setBorrador] = useState<BorradorTiempo | null>(null);
  const [panelVisible, setPanelVisible] = useState(true);

  const visibles: EventoCalendario[] = eventos.filter((evento) => !evento.data || !ocultos.includes(evento.data.filtro));
  if (borrador) {
    visibles.push({
      id: ID_BORRADOR,
      title: "Nuevo tiempo ocupado",
      start: new Date(`${borrador.fechaISO}T${borrador.inicio}:00-05:00`),
      end: new Date(`${borrador.fechaISO}T${borrador.fin}:00-05:00`),
      color: COLOR_TIPO[borrador.tipo],
      readOnly: true,
      data: { filtro: borrador.tipo, subtitulo: "", lineas: [], acciones: [] },
    });
  }

  function sincronizarUrl(vista: CalendarView, ancla: Date) {
    const nuevoModo = MODO_DE_VISTA[vista] ?? "semana";
    const nuevaFecha = fechaEnZonaLimaISO(ancla);
    if (nuevoModo === modo && nuevaFecha === fecha) return;
    router.replace(`${rutaBase}?modo=${nuevoModo}&fecha=${nuevaFecha}`, { scroll: false });
  }

  function abrirBorrador(slot: EventCalendarSlotDraft) {
    const fechaISO = fechaEnZonaLimaISO(slot.start);
    const inicioMin = slot.allDay ? 9 * 60 : minutosDelDiaLima(slot.start);
    const finMin = slot.allDay ? 13 * 60 : minutosDelDiaLima(slot.end) || 24 * 60 - 30;
    const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    setDetalle(null);
    setBorrador({
      fechaISO,
      dia: diaSemanaISO(fechaISO),
      inicio: hhmm(inicioMin),
      fin: hhmm(Math.min(finMin, 23 * 60 + 30)),
      tipo: "laboral",
      punto: { ...ultimoPuntero.current },
    });
  }

  function cerrarBorrador() {
    setBorrador(null);
    apiRef.current?.clearSelection();
  }

  return (
    <EventCalendar<DatoEvento>
      apiRef={apiRef}
      events={visibles}
      defaultView={VISTA_DE_MODO[modo]}
      defaultDate={new Date(`${fecha}T12:00:00-05:00`)}
      views={["month", "week", "agenda"]}
      timeZone={ZONA}
      locale={es}
      weekStartsOn={1}
      dayStartHour={7}
      dayEndHour={23}
      slotDuration={30}
      snapDuration={30}
      agendaDayCount={14}
      interactions={{ drag: false, resize: false, selectSlot: !soloLectura }}
      i18n={I18N}
      scrollMode="page"
      enableShortcuts={false}
      nowIndicator
      onRangeChange={(info) => sincronizarUrl(info.view, info.date)}
      onEventClick={(occurrence, evento) => {
        evento.preventDefault();
        if (occurrence.eventId === ID_BORRADOR) return;
        const rect = (evento.currentTarget as HTMLElement).getBoundingClientRect();
        setBorrador(null);
        setDetalle({ occurrence, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } });
      }}
      onSelectSlot={abrirBorrador}
      renderEvent={({ occurrence, view }) => <ContenidoEvento occurrence={occurrence} view={view} />}
      renderDayHeader={({ day, view, isToday }) => <CabeceraDia dia={day} vista={view} hoy={isToday} />}
      renderTimeGutterSlot={({ hour, minute }) => (hour === 7 && minute === 0 ? null : formatoHora(hour, minute))}
      classNames={{
        timeGrid: "border-t-0 [--ec-gutter-width:56px] [--ec-slot-line-color:var(--border-subtle)] [--ec-event-gutter:6px]",
        timeGridHeader: "border-border",
        timeGutterLabel: "end-2 -top-[7px] text-[11px] text-subtle-foreground",
        allDayLabel: "text-[11px] text-subtle-foreground",
        allDaySection: "border-border",
        dayColumn: "border-border",
        event: "items-start rounded-md bg-(--ec-event-color)/10 px-1.5 py-1 inset-ring-(--ec-event-color)/30 hover:bg-(--ec-event-color)/16 dark:bg-(--ec-event-color)/16 dark:hover:bg-(--ec-event-color)/24",
        monthCell: "border-border",
      }}
      todayClassName="bg-foreground/[0.02] data-today:text-foreground"
      className="flex-row flex-wrap items-start gap-6 text-xs"
      onPointerUpCapture={(evento: ReactPointerEvent<HTMLDivElement>) => {
        ultimoPuntero.current = { x: evento.clientX, y: evento.clientY };
      }}
    >
      {panelVisible ? <Lateral hoyISO={hoyISO} minutos={minutos} ocultos={ocultos} setOcultos={setOcultos} soloLectura={soloLectura} /> : null}
      <div className="flex min-w-0 flex-[999_1_640px] flex-col">
        <BarraCalendario fecha={fecha} panelVisible={panelVisible} onAlternarPanel={() => setPanelVisible((visible) => !visible)} soloLectura={soloLectura} />
        <div className="overflow-hidden rounded-[10px] border bg-background">
          <EventCalendarContent />
        </div>
      </div>

      {detalle ? <PopoverDetalle detalle={detalle} onCerrar={() => setDetalle(null)} /> : null}
      {borrador ? (
        <NuevoTiempoOcupado
          key={`${borrador.fechaISO}-${borrador.punto.x}-${borrador.punto.y}`}
          borrador={borrador}
          eventos={eventos}
          onCambiar={(cambios) => setBorrador((actual) => (actual ? { ...actual, ...cambios } : actual))}
          onCerrar={cerrarBorrador}
          volverA={`/calendario?modo=${modo}&fecha=${fecha}`}
        />
      ) : null}
    </EventCalendar>
  );
}

function ContenidoEvento({ occurrence, view }: { occurrence: EventCalendarOccurrence<DatoEvento>; view: CalendarView }) {
  const dato = occurrence.event.data;
  const esBorrador = occurrence.eventId === ID_BORRADOR;
  const punto = <span className="inline-block size-1.5 shrink-0 rounded-[2px] bg-(--ec-event-color)" aria-hidden />;
  if (occurrence.allDay || view === "month") {
    return (
      <span className="flex min-w-0 items-center gap-[5px] text-[11px] leading-4">
        {punto}
        <span className="truncate">{occurrence.event.title}</span>
      </span>
    );
  }
  const minutosInicio = minutosDelDiaLima(occurrence.start);
  const minutosFin = minutosDelDiaLima(occurrence.end) || 1440;
  return (
    <span className="flex min-w-0 flex-col">
      {esBorrador ? <span className="pointer-events-none absolute inset-0 rounded-md border border-dashed border-(--ec-event-color)" aria-hidden /> : null}
      <span className="flex min-w-0 items-center gap-[5px] text-xs leading-4 font-medium">
        {punto}
        <span className="truncate">{occurrence.event.title}</span>
      </span>
      <span className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
        {esBorrador || !dato?.subtitulo ? rangoHoras(minutosAPartes(minutosInicio), minutosAPartes(minutosFin)) : dato.subtitulo}
      </span>
    </span>
  );
}

function CabeceraDia({ dia, vista, hoy }: { dia: Date; vista: CalendarView; hoy: boolean }) {
  const iso = fechaEnZonaLimaISO(dia);
  if (vista === "month") return <span className="text-xs font-normal text-subtle-foreground">{DIAS[diaSemanaISO(iso) - 1]}</span>;
  return (
    <span className="block py-0.5 text-center">
      <span className="block text-xs font-normal text-subtle-foreground">{DIAS[diaSemanaISO(iso) - 1]}</span>
      <span
        className={cn(
          "mx-auto mt-1 grid size-7 place-items-center rounded-full text-[15px] font-medium text-foreground",
          hoy && "bg-foreground text-background",
        )}
      >
        {Number(iso.slice(8))}
      </span>
    </span>
  );
}

function BarraCalendario({ fecha, panelVisible, onAlternarPanel, soloLectura }: { fecha: string; panelVisible: boolean; onAlternarPanel: () => void; soloLectura: boolean }) {
  const navegacion = useEventCalendarNavigation();
  const { view, setView } = useEventCalendarView();
  const modo = MODO_DE_VISTA[view];
  const siguiente = modo === "mes" ? "Mes siguiente" : "Semana siguiente";
  const anterior = modo === "mes" ? "Mes anterior" : "Semana anterior";
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="size-[30px] text-muted-foreground"
        aria-label={panelVisible ? "Ocultar panel de fechas y filtros" : "Mostrar panel de fechas y filtros"}
        title={panelVisible ? "Ocultar panel" : "Mostrar panel"}
        aria-expanded={panelVisible}
        aria-controls="calendario-lateral"
        onClick={onAlternarPanel}
      >
        {panelVisible ? <PanelLeftClose aria-hidden /> : <PanelLeftOpen aria-hidden />}
      </Button>
      <h1 className="mr-2 text-xl font-semibold tracking-[-0.01em] first-letter:uppercase">
        {tituloPeriodo(modo, navegacion.activeRange.start, navegacion.activeRange.end)}
      </h1>
      <Button variant="outline" size="sm" className="h-[30px]" onClick={navegacion.today}>Hoy</Button>
      <span className="flex">
        <Button variant="ghost" size="icon" className="size-[30px]" aria-label={anterior} onClick={navegacion.prev}><ChevronLeft aria-hidden /></Button>
        <Button variant="ghost" size="icon" className="size-[30px]" aria-label={siguiente} onClick={navegacion.next}><ChevronRight aria-hidden /></Button>
      </span>
      <span className="flex-1" />
      <div role="group" aria-label="Vista" className="inline-flex gap-0.5 rounded-[7px] bg-secondary p-0.5">
        {(["mes", "semana", "agenda"] as const).map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={modo === opcion}
            onClick={() => setView(VISTA_DE_MODO[opcion])}
            className={cn(
              "h-7 rounded-[5px] px-3 text-[13px] text-muted-foreground capitalize transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              modo === opcion && "bg-background text-foreground shadow-xs ring-1 ring-border",
            )}
          >
            {opcion}
          </button>
        ))}
      </div>
      {soloLectura ? null : <BotonAgregar fecha={fecha} />}
    </div>
  );
}

function BotonAgregar({ fecha }: { fecha: string }) {
  const base = `/calendario?modo=semana&fecha=${fecha}`;
  return (
    <div className="inline-flex h-8 items-center rounded-md bg-primary text-[13px] font-medium text-primary-foreground">
      <Link href={`${base}&nuevoBloque=1`} scroll={false} className="flex h-full items-center gap-1.5 rounded-s-md ps-3 pe-2 hover:bg-primary/90">
        <Plus className="size-4" aria-hidden />
        Agregar
      </Link>
      <span className="h-4 w-px bg-primary-foreground/25" aria-hidden />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-full items-center rounded-e-md ps-1.5 pe-2 hover:bg-primary/90" aria-label="Más opciones para agregar">
          <ChevronDown className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild><Link href={`${base}&nuevoBloque=1`} scroll={false}>Tiempo ocupado</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/cursos?nuevo=1">Curso</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/cursos">Evaluación</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/reuniones/nueva">Reunión</Link></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Lateral({
  hoyISO,
  minutos,
  ocultos,
  setOcultos,
  soloLectura,
}: {
  hoyISO: string;
  minutos: Partial<Record<FiltroCalendario, number>>;
  ocultos: FiltroCalendario[];
  setOcultos: (valor: FiltroCalendario[]) => void;
  soloLectura: boolean;
}) {
  const alternar = (clave: FiltroCalendario) =>
    setOcultos(ocultos.includes(clave) ? ocultos.filter((otro) => otro !== clave) : [...ocultos, clave]);
  const fila = (filtro: { clave: FiltroCalendario; texto: string; color: string }, cantidad?: string) => {
    const activo = !ocultos.includes(filtro.clave);
    return (
      <label key={filtro.clave} className="flex h-[30px] cursor-pointer items-center gap-2.5 text-[13px]">
        <input type="checkbox" className="peer sr-only" checked={activo} onChange={() => alternar(filtro.clave)} />
        <span
          className="grid size-3.5 shrink-0 place-items-center rounded-[4px] border border-transparent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
          style={activo ? { background: filtro.color } : { borderColor: filtro.color }}
          aria-hidden
        >
          {activo ? <Check className="size-2.5 text-white" strokeWidth={3} /> : null}
        </span>
        <span className="flex-1">{filtro.texto}</span>
        {cantidad !== undefined ? <span className="text-xs text-subtle-foreground">{cantidad}</span> : null}
      </label>
    );
  };
  return (
    <aside id="calendario-lateral" aria-label="Fechas y filtros" className="flex w-full animate-in flex-col gap-6 fade-in-0 slide-in-from-left-2 duration-200 lg:w-[248px] lg:flex-none">
      <MiniMes hoyISO={hoyISO} />
      <div>
        <p className="mb-1 text-xs text-subtle-foreground">{soloLectura ? "Horario fijo" : "Mi horario fijo"}</p>
        {(soloLectura ? FILTROS_COMPANERO : FILTROS_HORARIO).map((filtro) => fila(filtro, minutos[filtro.clave] ? duracionMinutos(minutos[filtro.clave]!) : "0 h"))}
        {soloLectura ? null : (
          <>
            <p className="mt-3.5 mb-1 text-xs text-subtle-foreground">Fechas</p>
            {FILTROS_FECHAS.map((filtro) => fila(filtro))}
          </>
        )}
      </div>
      {soloLectura ? null : (
        <p className="text-xs leading-normal text-subtle-foreground">
          Las clases y el tiempo ocupado se repiten cada semana y son lo que tu grupo ve como “ocupado”, sin el detalle.
        </p>
      )}
    </aside>
  );
}

function MiniMes({ hoyISO }: { hoyISO: string }) {
  const navegacion = useEventCalendarNavigation();
  const anclaISO = fechaEnZonaLimaISO(navegacion.date);
  const [mes, setMes] = useState(anclaISO.slice(0, 7));
  const [anclaPrevia, setAnclaPrevia] = useState(anclaISO);
  // Si el calendario cambia de mes (flechas, Hoy), el mini mes lo acompaña.
  if (anclaPrevia !== anclaISO) {
    setAnclaPrevia(anclaISO);
    setMes(anclaISO.slice(0, 7));
  }
  const dias = diasDeVistaMes(mes);
  while (dias.length < 42) dias.push(sumarDiasISO(dias.at(-1)!, 1));
  const desde = fechaEnZonaLimaISO(navegacion.activeRange.start);
  const hasta = fechaEnZonaLimaISO(new Date(navegacion.activeRange.end.getTime() - 1));
  const [anio, numeroMes] = mes.split("-").map(Number);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-medium">{MESES_LARGOS[numeroMes - 1]} {anio}</span>
        <span className="flex">
          <Button variant="ghost" size="icon" className="size-[26px] text-muted-foreground" aria-label="Mes anterior" onClick={() => setMes(sumarMesesISO(mes, -1))}><ChevronLeft aria-hidden /></Button>
          <Button variant="ghost" size="icon" className="size-[26px] text-muted-foreground" aria-label="Mes siguiente" onClick={() => setMes(sumarMesesISO(mes, 1))}><ChevronRight aria-hidden /></Button>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {["lu", "ma", "mi", "ju", "vi", "sá", "do"].map((dia) => (
          <span key={dia} className="text-center text-[11px] text-subtle-foreground">{dia}</span>
        ))}
        {dias.map((dia) => {
          const enRango = dia >= desde && dia <= hasta;
          const esHoy = dia === hoyISO;
          return (
            <button
              key={dia}
              type="button"
              onClick={() => navegacion.goTo(new Date(`${dia}T12:00:00-05:00`))}
              aria-label={dia}
              aria-current={esHoy ? "date" : undefined}
              className={cn(
                "flex h-[26px] items-center justify-center rounded-md text-xs hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring",
                dia.slice(0, 7) === mes ? "text-foreground" : "text-subtle-foreground",
                enRango && "bg-secondary",
                esHoy && "bg-foreground font-semibold text-background hover:bg-foreground",
              )}
            >
              {Number(dia.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PopoverDetalle({ detalle, onCerrar }: { detalle: DetalleAbierto; onCerrar: () => void }) {
  const instancia = useEventCalendar<DatoEvento>();
  const { occurrence, rect } = detalle;
  const dato = occurrence.event.data;
  const estiloAncla: CSSProperties = { position: "fixed", left: rect.left, top: rect.top, width: rect.width, height: rect.height, pointerEvents: "none" };
  return (
    <Popover
      open
      onOpenChange={(abierto) => {
        if (!abierto) {
          onCerrar();
          instancia.api.clearSelection();
        }
      }}
    >
      <PopoverAnchor asChild><div style={estiloAncla} aria-hidden /></PopoverAnchor>
      <PopoverContent side="right" align="start" sideOffset={8} collisionPadding={16} className="w-[300px] rounded-[10px] p-4" aria-label={occurrence.event.title}>
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: occurrence.event.color }} aria-hidden />
          <span className="flex-1 text-[15px] font-semibold">{occurrence.event.title.split(" · ")[0]}</span>
          <Button variant="ghost" size="icon" className="size-[26px] text-muted-foreground" aria-label="Cerrar" onClick={onCerrar}><X aria-hidden /></Button>
        </div>
        {dato ? (
          <>
            <div className="mt-3 flex flex-col gap-2 text-[13px] text-muted-foreground">
              {dato.lineas.map((linea) => {
                const Icono = ICONOS[linea.icono];
                return (
                  <span key={linea.texto} className="flex items-start gap-2">
                    <Icono className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {linea.texto}
                  </span>
                );
              })}
            </div>
            {dato.acciones.length ? (
              <div className="mt-3.5 flex gap-2">
                {dato.acciones.map((accion) => (
                  <Button key={accion.href} variant={accion.principal ? "outline" : "ghost"} size="sm" asChild>
                    <Link href={accion.href}>{accion.texto}</Link>
                  </Button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
