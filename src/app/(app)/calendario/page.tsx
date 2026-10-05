import Link from "next/link";
import { requerirSesion } from "@/server/auth/session";
import { obtenerSemanaCalendario } from "@/server/services/calendario";
import {
  etiquetaSemana,
  fechaEnZonaLimaISO,
  lunesDeSemanaISO,
  minutosDelDiaLima,
  sumarDiasISO,
  type CategoriaCalendario,
} from "@/lib/calendario";
import { IconAgregar, IconChevronDerecha, IconChevronIzquierda } from "@/components/icons";
import { Toast } from "@/components/toast";
import { construirEntregas, construirItems, construirReuniones } from "./_components/items";
import { SegmentoCategorias, type VistaCalendario } from "./_components/segmento-categorias";
import { SemanaGrid } from "./_components/semana-grid";
import { AgendaSemana } from "./_components/agenda-semana";
import { consultaCalendario } from "./_components/rutas";

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
  searchParams: Promise<{ semana?: string; vista?: string; error?: string; toast?: string }>;
}) {
  const sesion = await requerirSesion();
  const { semana, vista: vistaParam, error, toast } = await searchParams;
  const vista: VistaCalendario = esVista(vistaParam) ? vistaParam : "todo";

  const ahora = new Date();
  const hoyISO = fechaEnZonaLimaISO(ahora);
  const semanaValida = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : null;
  const lunesISO = lunesDeSemanaISO(semanaValida ? new Date(`${semanaValida}T12:00:00-05:00`) : ahora);
  const esSemanaActual = lunesISO === lunesDeSemanaISO(ahora);

  const { dias, horarios, bloquesOcupados, evaluaciones, tareas, reuniones } = await obtenerSemanaCalendario(
    sesion.idUsuario,
    lunesISO,
  );

  const consulta = consultaCalendario(lunesISO, vista);
  const todosLosItems = construirItems(horarios, bloquesOcupados, consulta);
  const items =
    vista === "todo"
      ? [...todosLosItems, ...construirReuniones(reuniones)]
      : todosLosItems.filter((item) => item.categoria === vista);
  const entregas = construirEntregas(evaluaciones, tareas);

  const minutosPorCategoria: Record<CategoriaCalendario, number> = { clases: 0, laboral: 0, fam: 0 };
  for (const item of todosLosItems) {
    if (item.categoria !== "reunion") minutosPorCategoria[item.categoria] += item.finMin - item.inicioMin;
  }

  const enlaceSemana = (lunes: string) => `/calendario${consultaCalendario(lunes, vista)}`;
  const textos = TEXTOS[vista];

  return (
    <div className="animate-page-in mx-auto flex max-w-6xl flex-col gap-4">
      <Toast mensaje={toast} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Calendario</h1>
          <p className="mt-0.5 text-sm text-text-muted">{etiquetaSemana(lunesISO, Number(hoyISO.slice(0, 4)))}</p>
        </div>
        <div className="flex items-center gap-2">
          {esSemanaActual ? null : (
            <Link
              href={`/calendario${consultaCalendario(undefined, vista)}`}
              className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:bg-bg"
            >
              Esta semana
            </Link>
          )}
          <div className="flex overflow-hidden rounded-md border border-border-strong bg-surface">
            <Link
              href={enlaceSemana(sumarDiasISO(lunesISO, -7))}
              aria-label="Semana anterior"
              title="Semana anterior"
              className="grid size-8 place-items-center text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text"
            >
              <IconChevronIzquierda className="size-4" aria-hidden />
            </Link>
            <Link
              href={enlaceSemana(sumarDiasISO(lunesISO, 7))}
              aria-label="Semana siguiente"
              title="Semana siguiente"
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
        <SegmentoCategorias activa={vista} semanaISO={lunesISO} minutosPorCategoria={minutosPorCategoria} />
        <div className="flex items-center gap-2">
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
            Agregar bloque
          </Link>
        </div>
      </div>

      <SemanaGrid
        dias={dias}
        hoyISO={hoyISO}
        ahoraMin={minutosDelDiaLima(ahora)}
        items={items}
        entregas={entregas}
        mensajeVacio={textos.vacio}
      />
      <AgendaSemana dias={dias} hoyISO={hoyISO} items={items} entregas={entregas} textoDiaLibre={textos.diaLibre} />
    </div>
  );
}
