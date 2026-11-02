import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { obtenerCalendarioEntre } from "@/server/services/calendario";
import {
  diasDeLaSemana,
  diasDeVistaMes,
  esMesISO,
  etiquetaMes,
  etiquetaSemana,
  fechaEnZonaLimaISO,
  lunesDeSemanaISO,
  mesEnZonaLimaISO,
  minutosDelDiaLima,
  sumarDiasISO,
  sumarMesesISO,
  type CategoriaCalendario,
} from "@/lib/calendario";
import { IconAgregar, IconChevronDerecha, IconChevronIzquierda } from "@/components/icons";
import { Toast } from "@/components/toast";
import { construirEntregas, construirItems, construirReuniones, construirReunionesFecha } from "./_components/items";
import { SegmentoCategorias, type VistaCalendario } from "./_components/segmento-categorias";
import { SemanaGrid } from "./_components/semana-grid";
import { AgendaSemana } from "./_components/agenda-semana";
import { MesGrid } from "./_components/mes-grid";
import { ResumenMes } from "./_components/resumen-mes";
import { consultaCalendario } from "./_components/rutas";

type ModoCalendario = "mes" | "semana";

const TEXTOS: Record<VistaCalendario, { vacio: string; diaLibre: string }> = {
  todo: { vacio: "Sin clases ni bloques esta semana.", diaLibre: "Libre" },
  clases: { vacio: "Sin clases esta semana.", diaLibre: "Sin clases" },
  laboral: { vacio: "Sin horario laboral.", diaLibre: "Sin horario laboral" },
  fam: { vacio: "Sin bloques familiares o personales.", diaLibre: "Sin bloques" },
};

function esVista(valor: string | undefined): valor is VistaCalendario {
  return valor === "todo" || valor === "clases" || valor === "laboral" || valor === "fam";
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{
    semana?: string;
    mes?: string;
    modo?: string;
    vista?: string;
    error?: string;
    toast?: string;
  }>;
}) {
  const sesion = await requerirSesion();
  const { semana, mes, modo: modoParam, vista: vistaParam, error, toast } = await searchParams;
  const vista: VistaCalendario = esVista(vistaParam) ? vistaParam : "todo";
  // Los enlaces anteriores a esta mejora solo incluian `semana`; se conservan como vista semanal.
  const modo: ModoCalendario = modoParam === "semana" || (!modoParam && semana) ? "semana" : "mes";

  const ahora = new Date();
  const hoyISO = fechaEnZonaLimaISO(ahora);
  const mesActual = mesEnZonaLimaISO(ahora);
  const semanaValida = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : null;
  const mesISO = esMesISO(mes) ? mes : semanaValida?.slice(0, 7) ?? mesActual;
  const lunesISO = lunesDeSemanaISO(semanaValida ? new Date(`${semanaValida}T12:00:00-05:00`) : ahora);
  const dias = modo === "mes" ? diasDeVistaMes(mesISO) : diasDeLaSemana(lunesISO);
  const desdeISO = dias[0];
  const hastaISO = sumarDiasISO(dias.at(-1)!, 1);
  const { horarios, bloquesOcupados, evaluaciones, tareas, reuniones } = await obtenerCalendarioEntre(
    sesion.idUsuario,
    desdeISO,
    hastaISO,
  );

  const consulta = consultaCalendario(
    modo === "semana" ? lunesISO : undefined,
    vista,
    modo,
    modo === "mes" ? mesISO : undefined,
  );
  const todosLosItems = construirItems(horarios, bloquesOcupados, consulta);
  const itemsRecurrentes = todosLosItems.filter((item) => vista === "todo" || item.categoria === vista);
  const itemsSemana = vista === "todo" ? [...itemsRecurrentes, ...construirReuniones(reuniones)] : itemsRecurrentes;
  const entregas = construirEntregas(evaluaciones, tareas);
  const todasLasReunionesFecha = construirReunionesFecha(reuniones);
  const reunionesFecha = vista === "todo" ? todasLasReunionesFecha : [];

  const minutosPorCategoria: Record<CategoriaCalendario, number> = { clases: 0, laboral: 0, fam: 0 };
  for (const item of todosLosItems) {
    if (item.categoria !== "reunion") minutosPorCategoria[item.categoria] += item.finMin - item.inicioMin;
  }

  const enlacePeriodo = (periodo: string) =>
    modo === "mes"
      ? `/calendario${consultaCalendario(undefined, vista, "mes", periodo)}`
      : `/calendario${consultaCalendario(periodo, vista, "semana")}`;
  const periodoAnterior = modo === "mes" ? sumarMesesISO(mesISO, -1) : sumarDiasISO(lunesISO, -7);
  const periodoSiguiente = modo === "mes" ? sumarMesesISO(mesISO, 1) : sumarDiasISO(lunesISO, 7);
  const periodoActual = modo === "mes" ? mesISO === mesActual : lunesISO === lunesDeSemanaISO(ahora);
  const semanaAlCambiar = modo === "semana" ? lunesISO : lunesDeSemanaISO(new Date(`${mesISO}-01T12:00:00-05:00`));
  const mesAlCambiar = modo === "mes" ? mesISO : sumarDiasISO(lunesISO, 3).slice(0, 7);
  const textos = TEXTOS[vista];

  return (
    <div className="animate-page-in mx-auto flex max-w-[96rem] flex-col gap-4">
      <Toast mensaje={toast} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Calendario</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {modo === "mes" ? etiquetaMes(mesISO) : etiquetaSemana(lunesISO, Number(hoyISO.slice(0, 4)))}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <nav aria-label="Vista del calendario" className="flex overflow-hidden rounded-md border border-border-strong bg-surface text-sm">
            <Link
              href={`/calendario${consultaCalendario(undefined, vista, "mes", mesAlCambiar)}`}
              aria-current={modo === "mes" ? "page" : undefined}
              className={`px-3 py-1.5 transition-colors duration-150 ${
                modo === "mes" ? "bg-primary-soft font-medium text-primary" : "hover:bg-bg"
              }`}
            >
              Mes
            </Link>
            <Link
              href={`/calendario${consultaCalendario(semanaAlCambiar, vista, "semana")}`}
              aria-current={modo === "semana" ? "page" : undefined}
              className={`border-l border-border-strong px-3 py-1.5 transition-colors duration-150 ${
                modo === "semana" ? "bg-primary-soft font-medium text-primary" : "hover:bg-bg"
              }`}
            >
              Semana
            </Link>
          </nav>

          <Link
            href={`/calendario${consultaCalendario(undefined, vista, modo)}`}
            aria-current={periodoActual ? "date" : undefined}
            className={`rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:bg-bg ${
              periodoActual ? "text-primary" : ""
            }`}
          >
            Hoy
          </Link>
          <div className="flex overflow-hidden rounded-md border border-border-strong bg-surface">
            <Link
              href={enlacePeriodo(periodoAnterior)}
              aria-label={modo === "mes" ? "Mes anterior" : "Semana anterior"}
              title={modo === "mes" ? "Mes anterior" : "Semana anterior"}
              className="grid size-8 place-items-center text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text"
            >
              <IconChevronIzquierda className="size-4" aria-hidden />
            </Link>
            <Link
              href={enlacePeriodo(periodoSiguiente)}
              aria-label={modo === "mes" ? "Mes siguiente" : "Semana siguiente"}
              title={modo === "mes" ? "Mes siguiente" : "Semana siguiente"}
              className="grid size-8 place-items-center border-l border-border-strong text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text"
            >
              <IconChevronDerecha className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentoCategorias
          activa={vista}
          semanaISO={lunesISO}
          minutosPorCategoria={minutosPorCategoria}
          enlace={(nuevaVista) =>
            `/calendario${consultaCalendario(
              modo === "semana" ? lunesISO : undefined,
              nuevaVista,
              modo,
              modo === "mes" ? mesISO : undefined,
            )}`
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/cursos?nuevo=1#agregar-curso"
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:bg-bg"
          >
            <IconAgregar className="size-4" aria-hidden />
            Agregar curso
          </Link>
          <Link
            href={`/calendario/bloques/nuevo${consulta}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover"
          >
            <IconAgregar className="size-4" aria-hidden />
            Agregar tiempo ocupado
          </Link>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        Las clases y tus bloques se repiten cada semana; las evaluaciones, tareas y reuniones aparecen en su fecha.{" "}
        <Link href="/cursos" className="font-medium text-primary hover:underline">Ir a Cursos</Link>
      </p>

      {modo === "mes" ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <MesGrid
            dias={dias}
            mesISO={mesISO}
            hoyISO={hoyISO}
            items={itemsRecurrentes}
            entregas={entregas}
            reuniones={reunionesFecha}
          />
          <ResumenMes
            mesISO={mesISO}
            hoyISO={hoyISO}
            entregas={entregas}
            reuniones={todasLasReunionesFecha}
            minutosPorCategoria={minutosPorCategoria}
          />
        </div>
      ) : (
        <>
          <SemanaGrid
            dias={dias}
            hoyISO={hoyISO}
            ahoraMin={minutosDelDiaLima(ahora)}
            items={itemsSemana}
            entregas={entregas}
            mensajeVacio={textos.vacio}
          />
          <AgendaSemana dias={dias} hoyISO={hoyISO} items={itemsSemana} entregas={entregas} textoDiaLibre={textos.diaLibre} />
        </>
      )}
    </div>
  );
}
