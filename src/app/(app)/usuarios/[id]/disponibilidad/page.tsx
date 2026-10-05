import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth/session";
import { obtenerHorarioCompanero } from "@/server/services/disponibilidad";
import {
  diasDeLaSemana,
  fechaEnZonaLimaISO,
  lunesDeSemanaISO,
  minutosDelDiaLima,
  type CategoriaCalendario,
} from "@/lib/calendario";
import { Avatar } from "@/components/avatar";
import { construirItemsCompanero } from "../../../calendario/_components/items";
import { SegmentoCategorias, type VistaCalendario } from "../../../calendario/_components/segmento-categorias";
import { SemanaGrid } from "../../../calendario/_components/semana-grid";
import { AgendaSemana } from "../../../calendario/_components/agenda-semana";

const VISTAS: VistaCalendario[] = ["todo", "clases", "laboral", "fam"];

export default async function DisponibilidadCompaneroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { id } = await params;
  const idUsuario = Number(id);
  if (!Number.isInteger(idUsuario)) notFound();

  const sesion = await requerirSesion();
  const horario = await obtenerHorarioCompanero(sesion.idUsuario, idUsuario);
  if (!horario) notFound();

  const { vista: vistaParam } = await searchParams;
  const vista = VISTAS.find((v) => v === vistaParam) ?? "todo";

  const ahora = new Date();
  const hoyISO = fechaEnZonaLimaISO(ahora);
  const lunesISO = lunesDeSemanaISO(ahora);
  const todos = construirItemsCompanero(horario);
  const items = vista === "todo" ? todos : todos.filter((item) => item.categoria === vista);

  const minutosPorCategoria: Record<CategoriaCalendario, number> = { clases: 0, laboral: 0, fam: 0 };
  for (const item of todos) {
    if (item.categoria in minutosPorCategoria) {
      minutosPorCategoria[item.categoria as CategoriaCalendario] += item.finMin - item.inicioMin;
    }
  }

  return (
    <div className="animate-page-in mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <Link href={`/usuarios/${idUsuario}`} className="text-sm text-primary hover:underline">
          {horario.nombre} {horario.apellidos ?? ""}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <Avatar nombre={horario.nombre} apellidos={horario.apellidos} fotoUrl={horario.fotoUrl} />
          <h1 className="text-xl font-semibold">Disponibilidad</h1>
        </div>
      </div>

      <SegmentoCategorias
        activa={vista}
        semanaISO={lunesISO}
        minutosPorCategoria={minutosPorCategoria}
        enlace={(v) => `/usuarios/${idUsuario}/disponibilidad?vista=${v}`}
      />

      <SemanaGrid
        dias={diasDeLaSemana(lunesISO)}
        hoyISO={hoyISO}
        ahoraMin={minutosDelDiaLima(ahora)}
        items={items}
        entregas={[]}
        mensajeVacio="Sin clases ni bloques registrados."
      />
      <AgendaSemana dias={diasDeLaSemana(lunesISO)} hoyISO={hoyISO} items={items} entregas={[]} textoDiaLibre="Libre" />
    </div>
  );
}
