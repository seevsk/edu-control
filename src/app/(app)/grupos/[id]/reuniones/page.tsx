import { metadataDeGrupo } from "../_components/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Video } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { listarMisReuniones } from "@/server/services/reunion";
import { Toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { AccionDobleGrupo, FabReunirse, ProgramarMovil } from "@/components/ui-app/reuniones/acciones-grupo-reunion";
import { BotonReunirseAhora } from "@/components/ui-app/reuniones/boton-reunirse-ahora";
import { EncabezadoSeccionReunion } from "@/components/ui-app/reuniones/encabezado-seccion";
import { FilaReunion } from "@/components/ui-app/reuniones/fila-reunion";
import type { Respuesta } from "@/components/ui-app/reuniones/formato";
import { MarcoGrupo } from "../_components/marco-grupo";
import { HojaProgramarReunion } from "@/components/ui-app/reuniones/hoja-programar-reunion";
import { RefrescoEnVivo } from "@/components/ui-app/reuniones/refresco-en-vivo";
import { FormularioReunion } from "@/app/(app)/reuniones/nueva/formulario-reunion";
import { cargarDatosProgramar, inicialesDeParametros } from "@/app/(app)/reuniones/nueva/datos-programar";

export const generateMetadata = metadataDeGrupo("Reuniones");

export default async function ReunionesGrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    toast?: string;
    programar?: string;
    fecha?: string;
    inicio?: string;
    fin?: string;
    titulo?: string;
    lugar?: string;
    sala?: string;
  }>;
}) {
  const { id } = await params;
  const { error, toast, programar, fecha, inicio, fin, titulo, lugar, sala } = await searchParams;
  const idGrupo = Number(id);
  if (!Number.isInteger(idGrupo)) notFound();

  const sesion = await requerirSesion();
  const datos = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!datos) notFound();

  const { enCurso: salasAbiertas, proximas: programadas, pasadas } = await listarMisReuniones(sesion.idUsuario);
  // "En curso" = ya la inició alguien; una sala abierta sin iniciar sigue en Próximas (con su etiqueta).
  const enCurso = salasAbiertas.filter((reunion) => reunion.iniciadaEn !== null);
  const proximas = [...salasAbiertas.filter((reunion) => reunion.iniciadaEn === null), ...programadas].sort(
    (a, b) => a.inicio.getTime() - b.inicio.getTime(),
  );
  const delGrupo = <T extends { idGrupo: number }>(lista: T[]) => lista.filter((reunion) => reunion.idGrupo === idGrupo);
  const enCursoGrupo = delGrupo(enCurso);
  const proximasGrupo = delGrupo(proximas);
  const pasadasGrupo = delGrupo(pasadas);
  const hayReuniones = enCursoGrupo.length + proximasGrupo.length + pasadasGrupo.length > 0;

  const observador = datos.rolActual === "observador";
  const puedeParticipar = !observador && datos.grupo.estado === "activo";
  const programarAbierto = programar === "1" && puedeParticipar;
  const datosHoja = programarAbierto ? await cargarDatosProgramar(sesion.idUsuario, idGrupo) : null;
  const ahoraInicial = new Date().toISOString();
  const idCurso = datos.grupo.evaluacion?.curso?.idCurso ?? null;
  const respuestaDe = (reunion: { asistentes: { idUsuario: number; respuesta: Respuesta }[] }): Respuesta =>
    reunion.asistentes.find((asistente) => asistente.idUsuario === sesion.idUsuario)?.respuesta ?? "pendiente";

  const fila = (reunion: (typeof proximasGrupo)[number], destacada = false) => (
    <FilaReunion
      key={reunion.idReunion}
      reunion={reunion}
      variante="grupo"
      ahoraInicial={ahoraInicial}
      puedeUnirse={!observador}
      observador={observador}
      miRespuesta={respuestaDe(reunion)}
      idCurso={idCurso}
      destacada={destacada}
    />
  );

  return (
    <MarcoGrupo
      datos={datos}
      idUsuario={sesion.idUsuario}
      activa="reuniones"
      accionPrincipal={puedeParticipar && hayReuniones ? <AccionDobleGrupo idGrupo={idGrupo} enCurso={enCursoGrupo.length > 0} /> : null}
      accionMovil={puedeParticipar ? <ProgramarMovil idGrupo={idGrupo} /> : null}
      superponer={puedeParticipar ? <FabReunirse idGrupo={idGrupo} enCurso={enCursoGrupo.length > 0} /> : null}
    >
      <Toast mensaje={toast} />
      {enCursoGrupo.length > 0 ? <RefrescoEnVivo /> : null}
      {datosHoja ? (
        <HojaProgramarReunion cerrarEn={`/grupos/${idGrupo}/reuniones`}>
          <FormularioReunion
            grupos={[]}
            idGrupo={idGrupo}
            hoyISO={datosHoja.hoyISO}
            integrantes={datosHoja.integrantes}
            reunionesProgramadas={datosHoja.reunionesProgramadas}
            sugerencias={datosHoja.sugerencias}
            iniciales={inicialesDeParametros({ fecha, inicio, fin, titulo, lugar }, datosHoja.hoyISO)}
            errorSala={sala === "error"}
            mensajeError={sala === "error" ? null : (error ?? null)}
            modoHoja
          />
        </HojaProgramarReunion>
      ) : null}
      <div className="-mx-4 -my-5 sm:-mx-6">
        {error && !programarAbierto ? (
          <p role="alert" className="mx-4 mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger sm:mx-6">
            {error}
          </p>
        ) : null}
        {!hayReuniones ? (
          <div className="flex flex-col items-center gap-3.5 px-6 py-24 lg:py-[120px]">
            <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Video className="size-[22px]" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">Sin reuniones</p>
            {puedeParticipar ? (
              <div className="flex flex-wrap justify-center gap-2 max-md:hidden">
                <BotonReunirseAhora idGrupo={idGrupo} tamano="m" />
                <Button variant="outline" asChild className="h-8 px-3 text-[13px]">
                  <Link href={`/reuniones/nueva?grupo=${idGrupo}`}>
                    <CalendarPlus aria-hidden />
                    Programar reunión
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {enCursoGrupo.length > 0 ? (
              <section>
                <EncabezadoSeccionReunion texto="En curso" cantidad={enCursoGrupo.length} />
                <ul>{enCursoGrupo.map((reunion) => fila(reunion, true))}</ul>
              </section>
            ) : null}
            {proximasGrupo.length > 0 ? (
              <section>
                <EncabezadoSeccionReunion texto="Próximas" cantidad={proximasGrupo.length} />
                <ul>{proximasGrupo.map((reunion) => fila(reunion))}</ul>
              </section>
            ) : null}
            {pasadasGrupo.length > 0 ? (
              <section>
                <EncabezadoSeccionReunion texto="Pasadas" cantidad={pasadasGrupo.length} />
                <ul>{pasadasGrupo.map((reunion) => fila(reunion))}</ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </MarcoGrupo>
  );
}
