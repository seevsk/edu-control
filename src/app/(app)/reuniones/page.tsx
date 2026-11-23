import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, Video } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { gruposParaProgramar, listarMisReuniones } from "@/server/services/reunion";
import { aOracion } from "@/lib/presentacion";
import { cn } from "@/lib/utils";
import { Migas } from "@/components/ui-app/barra-superior";
import { Toast } from "@/components/toast";
import { FilaDesplazable } from "@/components/ui-app/fila-desplazable";
import { ACCION_MOVIL, ChipsFiltro, EncabezadoMovil, PaginaCompleta, VolverMovil } from "@/components/ui-app/page-header";
import { Button } from "@/components/ui/button";
import { EncabezadoSeccionReunion } from "@/components/ui-app/reuniones/encabezado-seccion";
import { FilaReunion } from "@/components/ui-app/reuniones/fila-reunion";
import { RefrescoEnVivo } from "@/components/ui-app/reuniones/refresco-en-vivo";
import type { Respuesta } from "@/components/ui-app/reuniones/formato";
import { SelectorGrupoReunion } from "@/components/ui-app/reuniones/selector-grupo-reunion";

export const metadata: Metadata = { title: "Reuniones" };

export default async function ReunionesPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string; error?: string; toast?: string }>;
}) {
  const sesion = await requerirSesion();
  const { grupo, error, toast } = await searchParams;
  const [{ enCurso: salasAbiertas, proximas: programadas, pasadas, rolPorGrupo }, programables] = await Promise.all([
    listarMisReuniones(sesion.idUsuario),
    gruposParaProgramar(sesion.idUsuario),
  ]);

  // "En curso" = ya la inició alguien; una sala abierta sin iniciar sigue en Próximas (con su etiqueta).
  const enCurso = salasAbiertas.filter((reunion) => reunion.iniciadaEn !== null);
  const proximas = [...salasAbiertas.filter((reunion) => reunion.iniciadaEn === null), ...programadas].sort(
    (a, b) => a.inicio.getTime() - b.inicio.getTime(),
  );

  const grupos = new Map<number, string>();
  for (const reunion of [...enCurso, ...proximas, ...pasadas]) grupos.set(reunion.idGrupo, reunion.grupo.nombre);
  const filtro = grupo && grupos.has(Number(grupo)) ? Number(grupo) : null;
  const filtrar = <T extends { idGrupo: number }>(lista: T[]) => (filtro ? lista.filter((reunion) => reunion.idGrupo === filtro) : lista);

  const gruposEnCurso = new Set(enCurso.map((reunion) => reunion.idGrupo));
  const gruposReunirse = programables
    .filter((g) => !filtro || g.idGrupo === filtro)
    .map((g) => ({
      idGrupo: g.idGrupo,
      nombre: g.nombre,
      curso: g.evaluacion?.curso ?? null,
      enCurso: gruposEnCurso.has(g.idGrupo),
    }));
  const hrefProgramar = filtro ? `/reuniones/nueva?grupo=${filtro}` : "/reuniones/nueva";
  const puedeProgramar = programables.length > 0;

  const ahoraInicial = new Date().toISOString();
  const filas = (lista: typeof proximas, destacada = false) =>
    filtrar(lista).map((reunion) => {
      const rol = rolPorGrupo.get(reunion.idGrupo) ?? "observador";
      const observador = rol === "observador";
      const mia: Respuesta = reunion.asistentes.find((a) => a.idUsuario === sesion.idUsuario)?.respuesta ?? "pendiente";
      return (
        <FilaReunion
          key={reunion.idReunion}
          reunion={reunion}
          variante="modulo"
          ahoraInicial={ahoraInicial}
          puedeUnirse={!observador}
          observador={observador}
          miRespuesta={mia}
          idCurso={reunion.grupo.evaluacion?.idCurso ?? null}
          destacada={destacada}
        />
      );
    });
  const hayAlgo = filtrar(enCurso).length + filtrar(proximas).length + filtrar(pasadas).length > 0;

  const opcionesFiltro = [
    { href: "/reuniones", texto: "Todos", activa: filtro === null },
    ...[...grupos].map(([id, nombre]) => ({ href: `/reuniones?grupo=${id}`, texto: aOracion(nombre), activa: filtro === id })),
  ];

  return (
    <PaginaCompleta>
      <Migas items={[{ texto: "Reuniones" }]} />
      <Toast mensaje={toast} />
      <VolverMovil href="/tu" texto="Tú" className="mt-1 ml-2" />
      <EncabezadoMovil
        titulo="Reuniones"
        acciones={
          puedeProgramar ? (
            <>
              <SelectorGrupoReunion grupos={gruposReunirse} icono />
              <Link href={hrefProgramar} aria-label="Programar reunión" className={ACCION_MOVIL}>
                <CalendarPlus aria-hidden />
              </Link>
            </>
          ) : null
        }
      />
      <header className="hidden items-center gap-3 border-b px-5 pt-5 pb-3.5 md:flex lg:px-8">
        <h1 className="flex-1 text-xl font-semibold">Reuniones</h1>
        {enCurso.length > 0 ? <RefrescoEnVivo /> : null}
        {puedeProgramar ? (
          <>
            <SelectorGrupoReunion grupos={gruposReunirse} tamano="tactil" className="lg:hidden" />
            <SelectorGrupoReunion grupos={gruposReunirse} tamano="m" className="max-lg:hidden" />
            <Button variant="outline" asChild className="h-8 px-3 text-[13px]">
              <Link href={hrefProgramar}>
                <CalendarPlus aria-hidden />
                Programar reunión
              </Link>
            </Button>
          </>
        ) : null}
      </header>

      {error ? (
        <p role="alert" className="mx-4 mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger md:mx-5 lg:mx-8">
          {error}
        </p>
      ) : null}

      {grupos.size > 1 ? (
        <>
          <ChipsFiltro etiqueta="Filtrar por grupo" opciones={opcionesFiltro} className="md:hidden" />
          <FilaDesplazable as="nav" aria-label="Filtrar por grupo" className="hidden border-b md:block" scrollerClassName="flex gap-1 px-5 py-2.5 lg:px-8">
            {opcionesFiltro.map((opcion) => (
              <Link
                key={opcion.href}
                href={opcion.href}
                aria-current={opcion.activa ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 shrink-0 items-center rounded-[7px] px-2.5 text-[13px] whitespace-nowrap",
                  opcion.activa ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opcion.texto}
              </Link>
            ))}
          </FilaDesplazable>
        </>
      ) : null}

      {hayAlgo ? (
        <>
          {filtrar(enCurso).length > 0 ? (
            <section>
              <EncabezadoSeccionReunion ancho="modulo" texto="En curso" cantidad={filtrar(enCurso).length} />
              <ul>{filas(enCurso, true)}</ul>
            </section>
          ) : null}
          {filtrar(proximas).length > 0 ? (
            <section>
              <EncabezadoSeccionReunion ancho="modulo" texto="Próximas" cantidad={filtrar(proximas).length} />
              <ul>{filas(proximas)}</ul>
            </section>
          ) : null}
          {filtrar(pasadas).length > 0 ? (
            <section>
              <EncabezadoSeccionReunion ancho="modulo" texto="Anteriores" />
              <ul>{filas(pasadas)}</ul>
            </section>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3.5 px-6 py-24">
          <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Video className="size-[22px]" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">Sin reuniones</p>
        </div>
      )}
    </PaginaCompleta>
  );
}
