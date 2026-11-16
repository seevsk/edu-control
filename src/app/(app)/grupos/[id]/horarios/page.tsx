import { metadataDeGrupo } from "../_components/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { obtenerGrupoDelUsuario } from "@/server/services/grupo";
import { obtenerDisponibilidadGrupo } from "@/server/services/disponibilidad";
import { reunionesDelGrupoEntre } from "@/server/services/reunion";
import { DIAS_CORTOS, fechaEnZonaLimaISO, lunesDeSemanaISO, minutosDelDiaLima, sumarDiasISO } from "@/lib/calendario";
import { bloquearReunionesParaTodos, diasLibresParaTodos, huecos, mapaDeDisponibilidad, type Hueco } from "@/lib/disponibilidad";
import { formatoHora, rangoHoras } from "@/lib/formato-fecha";
import { nombreCorto } from "@/lib/nombres";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { Toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { MarcoGrupo } from "../_components/marco-grupo";
import { MapaCalor } from "./_components/mapa-calor";
import { HorariosMovil } from "./_components/horarios-movil";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
/** Las mejores ventanas se buscan en un horario razonable: 8:00am - 8:00pm, de lunes a sábado. */
const VENTANA_REUNION = { desdeMin: 8 * 60, hastaMin: 20 * 60, pasoMin: 30 };
const MAX_SUGERENCIAS = 3;

const partes = (minutos: number) => ({ horas: Math.floor(minutos / 60), minutos: minutos % 60 });
const hora = (minutos: number) => formatoHora(Math.floor(minutos / 60), minutos % 60);
const rango = (inicio: number, fin: number) => rangoHoras(partes(inicio), partes(fin));
const hhmm = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

function duracion(minutos: number) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

function etiquetaSemana(lunesISO: string) {
  const [, mesA, diaA] = lunesISO.split("-").map(Number);
  const [, mesB, diaB] = sumarDiasISO(lunesISO, 6).split("-").map(Number);
  return mesA === mesB
    ? `Semana del ${diaA} al ${diaB} ${MESES[mesB - 1]}`
    : `Semana del ${diaA} ${MESES[mesA - 1]} al ${diaB} ${MESES[mesB - 1]}`;
}

export const generateMetadata = metadataDeGrupo("Horarios");

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
  const datos = await obtenerGrupoDelUsuario(sesion.idUsuario, idGrupo).catch(() => null);
  if (!datos) notFound();
  const { grupo, rolActual } = datos;

  if (rolActual === "observador") {
    return (
      <MarcoGrupo datos={datos} idUsuario={sesion.idUsuario} activa="horarios">
        <p className="text-[13px] text-muted-foreground">Los horarios del grupo solo los ven sus integrantes, no los observadores.</p>
      </MarcoGrupo>
    );
  }

  const { semana, toast } = await searchParams;
  const ahora = new Date();
  const hoyISO = fechaEnZonaLimaISO(ahora);
  const ahoraMin = minutosDelDiaLima(ahora);
  const fechaSemana = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? new Date(`${semana}T12:00:00-05:00`) : null;
  const lunesISO = lunesDeSemanaISO(fechaSemana && !Number.isNaN(fechaSemana.getTime()) ? fechaSemana : ahora);
  const lunesActualISO = lunesDeSemanaISO(ahora);
  const desde = new Date(`${lunesISO}T00:00:00-05:00`);
  const hasta = new Date(`${sumarDiasISO(lunesISO, 7)}T00:00:00-05:00`);

  const [base, reuniones] = await Promise.all([
    obtenerDisponibilidadGrupo(sesion.idUsuario, idGrupo),
    reunionesDelGrupoEntre(sesion.idUsuario, idGrupo, desde, hasta),
  ]);
  const integrantes = bloquearReunionesParaTodos(base, reuniones);
  const personas = integrantes.map((integrante) => ({
    idUsuario: integrante.idUsuario,
    nombre: integrante.nombre,
    apellidos: integrante.apellidos,
    fotoUrl: integrante.fotoUrl,
    corto: nombreCorto(integrante.nombre, integrante.apellidos),
  }));
  const nombres = new Map(personas.map((persona) => [persona.idUsuario, persona.corto]));
  const mapa = mapaDeDisponibilidad(integrantes);
  const mapaReunion = mapaDeDisponibilidad(integrantes, VENTANA_REUNION).slice(0, 6);
  const puedeProgramar = grupo.estado === "activo";
  const fechaDe = (diaSemana: number) => sumarDiasISO(lunesISO, diaSemana - 1);

  // Recorta lo que ya pasó: un hueco de hoy empieza en la siguiente media hora.
  const vigente = (hueco: Hueco) => {
    const fecha = fechaDe(hueco.diaSemana);
    if (fecha < hoyISO) return null;
    const inicioMin = fecha === hoyISO ? Math.max(hueco.inicioMin, Math.ceil((ahoraMin + 1) / 30) * 30) : hueco.inicioMin;
    return hueco.finMin - inicioMin >= 60 ? { ...hueco, inicioMin, fecha } : null;
  };
  type Sugerencia = NonNullable<ReturnType<typeof vigente>>;
  // Las más largas primero, una por día.
  const elegir = (lista: Hueco[]) => {
    const elegidas: Sugerencia[] = [];
    const candidatas = lista
      .map(vigente)
      .filter((hueco): hueco is Sugerencia => hueco !== null)
      .sort((a, b) => b.finMin - b.inicioMin - (a.finMin - a.inicioMin));
    for (const hueco of candidatas) {
      if (elegidas.some((otro) => otro.fecha === hueco.fecha)) continue;
      elegidas.push(hueco);
      if (elegidas.length === MAX_SUGERENCIAS) break;
    }
    return elegidas;
  };
  const todosLibres = elegir(huecos(mapaReunion));
  const sugerencias = todosLibres.length || personas.length <= 2 ? todosLibres : elegir(huecos(mapaReunion, { toleranciaFaltantes: 1 }));

  const horas = mapa[0].map((franja) => rango(franja.inicioMin, franja.finMin));
  const dias = mapa.map((franjas, indice) => ({
    corto: DIAS_CORTOS[indice],
    numero: Number(fechaDe(indice + 1).slice(8)),
    ocupados: franjas.map((franja) => franja.ocupados),
  }));
  const diasLibres = diasLibresParaTodos(mapa);
  const hrefSemana = (iso: string) => `/grupos/${idGrupo}/horarios?semana=${iso}`;

  return (
    <MarcoGrupo datos={datos} idUsuario={sesion.idUsuario} activa="horarios">
      <Toast mensaje={toast} />
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <nav aria-label="Navegar por semanas" className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-base font-semibold">{etiquetaSemana(lunesISO)}</h2>
            {lunesISO !== lunesActualISO ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={hrefSemana(lunesActualISO)}>Esta semana</Link>
              </Button>
            ) : null}
            <span className="flex">
              <Button variant="ghost" size="icon" className="size-11 md:size-8" asChild>
                <Link href={hrefSemana(sumarDiasISO(lunesISO, -7))} aria-label="Semana anterior"><ChevronLeft aria-hidden /></Link>
              </Button>
              <Button variant="ghost" size="icon" className="size-11 md:size-8" asChild>
                <Link href={hrefSemana(sumarDiasISO(lunesISO, 7))} aria-label="Semana siguiente"><ChevronRight aria-hidden /></Link>
              </Button>
            </span>
          </nav>

          <section aria-labelledby="titulo-mejores">
            <h3 id="titulo-mejores" className="mb-2.5 text-[13px] font-medium">
              Mejores horarios para reunirse <span className="font-normal text-subtle-foreground">· de 8:00am a 8:00pm, de lunes a sábado</span>
            </h3>
            {sugerencias.length ? (
              <div className="flex flex-wrap gap-3">
                {sugerencias.map((hueco) => {
                  const [, mes, dia] = hueco.fecha.split("-").map(Number);
                  const todos = hueco.faltan.length === 0;
                  const fin = Math.min(hueco.inicioMin + 60, hueco.finMin);
                  return (
                    <div key={hueco.fecha} className="flex flex-[1_1_190px] flex-col gap-1 rounded-[10px] border p-3.5 shadow-card">
                      <span className="text-xs text-subtle-foreground">{DIAS_CORTOS[hueco.diaSemana - 1]} {dia} {MESES[mes - 1]}</span>
                      <span className="text-base font-semibold tabular-nums">{rango(hueco.inicioMin, hueco.finMin)}</span>
                      <span className={`flex items-center gap-1.5 text-xs ${todos ? "text-estado-completada" : "text-muted-foreground"}`}>
                        <span className={`size-[7px] shrink-0 rounded-[2px] ${todos ? "bg-estado-completada" : "bg-estado-completada/40"}`} aria-hidden />
                        {todos ? "Todos libres" : `Falta ${hueco.faltan.map((idUsuario) => nombres.get(idUsuario)).join(", ")}`} · {duracion(hueco.finMin - hueco.inicioMin)}
                      </span>
                      {puedeProgramar ? (
                        <Button variant="outline" size="sm" className="mt-2 w-fit" asChild>
                          <Link href={`/reuniones/nueva?grupo=${idGrupo}&fecha=${hueco.fecha}&inicio=${hhmm(hueco.inicioMin)}&fin=${hhmm(fin)}`}>
                            Programar reunión
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-[10px] border border-dashed border-input p-4 text-[13px] text-muted-foreground">
                No hay una hora seguida en la que todos estén libres esta semana. Revisa el mapa o prueba la semana siguiente.
              </p>
            )}
          </section>

          <section aria-label="Disponibilidad del grupo por día" className="md:hidden">
            <HorariosMovil
              dias={mapa.map((franjas, indice) => ({ fechaISO: fechaDe(indice + 1), corto: DIAS_CORTOS[indice], numero: Number(fechaDe(indice + 1).slice(8)), ocupados: franjas.map((franja) => franja.ocupados) }))}
              franjas={mapa[0].map((franja) => ({ inicioMin: franja.inicioMin, finMin: franja.finMin }))}
              personas={personas.map((persona) => ({ idUsuario: persona.idUsuario, corto: persona.idUsuario === sesion.idUsuario ? "Tú" : persona.corto }))}
              idGrupo={idGrupo}
              puedeProgramar={puedeProgramar}
              hoyISO={hoyISO}
            />
          </section>

          <section aria-labelledby="titulo-mapa" className="max-md:hidden">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <h3 id="titulo-mapa" className="flex-1 text-[13px] font-medium">Disponibilidad del grupo</h3>
              <Leyenda clase="bg-estado-completada/50 dark:bg-estado-completada/55" texto="Todos libres" />
              <Leyenda clase="bg-estado-completada/10 dark:bg-estado-completada/16" texto="Falta 1" />
              <Leyenda clase="bg-secondary" texto="Faltan 2 o más" />
            </div>
            <MapaCalor dias={dias} horas={horas} marcas={mapa[0].map((franja) => hora(franja.inicioMin))} personas={personas} />
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_240px] flex-col gap-6">
          <section aria-labelledby="titulo-integrantes">
            <h3 id="titulo-integrantes" className="mb-1 text-[13px] font-medium">Integrantes</h3>
            {personas.map((persona) => (
              <div key={persona.idUsuario} className="flex items-center gap-2.5 py-1.5 text-[13px]">
                <UserAvatar usuario={persona} tamano="md" />
                <span className="min-w-0 flex-1 truncate">
                  {persona.corto}
                  {persona.idUsuario === sesion.idUsuario ? <span className="text-subtle-foreground"> (tú)</span> : null}
                </span>
                {persona.idUsuario !== sesion.idUsuario ? (
                  <Link href={`/usuarios/${persona.idUsuario}/disponibilidad`} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                    Ver su horario
                  </Link>
                ) : null}
              </div>
            ))}
          </section>

          <section aria-labelledby="titulo-libres">
            <h3 id="titulo-libres" className="mb-2 text-[13px] font-medium">Días completamente libres</h3>
            {diasLibres.length ? (
              <div className="flex flex-wrap gap-1.5">
                {diasLibres.map((diaSemana) => (
                  <span key={diaSemana} className="rounded-full border border-estado-completada/30 px-2 py-0.5 text-xs text-estado-completada">
                    {DIAS_CORTOS[diaSemana - 1]} {Number(fechaDe(diaSemana).slice(8))} · todo el día
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-subtle-foreground">Ninguno esta semana.</p>
            )}
          </section>

          <p className="text-xs leading-relaxed text-subtle-foreground">
            Se calcula con las clases y el tiempo ocupado de cada integrante, más las reuniones ya programadas. Nunca muestra el motivo de una ocupación.
          </p>
        </aside>
      </div>
    </MarcoGrupo>
  );
}

function Leyenda({ clase, texto }: { clase: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2.5 w-3.5 rounded-[2px] ${clase}`} aria-hidden />
      {texto}
    </span>
  );
}
