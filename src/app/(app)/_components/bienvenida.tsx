import Link from "next/link";
import { Check, Eye, EyeOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colorCurso } from "@/lib/presentacion";
import { cn } from "@/lib/utils";
import { ocultarBienvenidaAction } from "../actions";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie"];
/** Ventana del mini calendario: 7:00am a 11:00pm. */
const DESDE = 7 * 60;
const HASTA = 23 * 60;
const MARCADORES = [
  { dia: 2, desde: 9 * 60, hasta: 12 * 60 },
  { dia: 4, desde: 7 * 60, hasta: 9 * 60 },
  { dia: 5, desde: 16 * 60, hasta: 19 * 60 },
  { dia: 3, desde: 19 * 60, hasta: 21 * 60 },
];

export interface DatosBienvenida {
  nombre: string;
  perfilCompleto: boolean;
  visibleEnBusqueda: boolean;
  cursosConHorario: number;
  tieneGrupo: boolean;
  invitacionesPendientes: number;
  /** Sesiones de lunes a viernes para la vista previa de la semana. */
  sesiones: { idCurso: number; diaSemana: number; inicioMin: number; finMin: number }[];
}

function Paso({
  numero,
  hecho,
  titulo,
  descripcion,
  children,
}: {
  numero: number;
  hecho: boolean;
  titulo: string;
  descripcion: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-4 border-b border-border-subtle py-[18px]">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full text-[13px]",
          hecho ? "bg-estado-completada text-background" : "border-[1.5px] border-input text-muted-foreground",
        )}
        aria-hidden
      >
        {hecho ? <Check className="size-3.5" strokeWidth={3} /> : numero}
      </span>
      <div className="min-w-[240px] flex-1">
        <p className={cn("text-[15px] font-medium", hecho && "text-subtle-foreground line-through")}>
          <span className="sr-only">{hecho ? "Hecho: " : `Paso ${numero}: `}</span>
          {titulo}
        </p>
        <p className="mt-0.5 text-[13px] text-subtle-foreground">{descripcion}</p>
      </div>
      {hecho ? <span className="text-[13px] text-subtle-foreground">Hecho</span> : children}
    </li>
  );
}

/** Primer ingreso (Claude Design, "Bienvenida en 3 pasos"): se muestra hasta completar los pasos u ocultarla. */
export function Bienvenida({ datos, fechaTexto }: { datos: DatosBienvenida; fechaTexto: string }) {
  const pasos = [datos.perfilCompleto, datos.cursosConHorario > 0, datos.tieneGrupo];
  const hechos = pasos.filter(Boolean).length;
  const siguiente = pasos.findIndex((hecho) => !hecho);

  return (
    <section aria-labelledby="titulo-bienvenida" className="border-b px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-[1040px] flex-wrap items-start gap-12">
        <div className="min-w-0 flex-[2_1_520px]">
          <p className="text-[13px] text-subtle-foreground">{fechaTexto}</p>
          <h2 id="titulo-bienvenida" className="mt-1.5 text-[28px] font-semibold tracking-[-0.02em]">Hola, {datos.nombre}</h2>
          <p className="mt-2 text-[15px] text-muted-foreground">Deja EduControl listo en tres pasos. Toma unos 5 minutos.</p>

          <div className="mt-6 mb-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={hechos} aria-label="Avance de la guía">
              <div className="h-full rounded-full bg-estado-completada transition-[width] duration-500" style={{ width: `${(hechos / 3) * 100}%` }} />
            </div>
            <span className="text-[13px] text-muted-foreground tabular-nums">{hechos} de 3</span>
          </div>

          <ol>
            <Paso numero={1} hecho={pasos[0]} titulo="Completa tu perfil" descripcion="Carrera, ciclo e institución. Así te encuentran tus compañeros.">
              <Button size="sm" variant={siguiente === 0 ? "default" : "outline"} asChild>
                <Link href="/perfil?editar=1">Completar perfil</Link>
              </Button>
            </Paso>
            <Paso
              numero={2}
              hecho={pasos[1]}
              titulo="Agrega tus cursos con su horario"
              descripcion="Con tus clases calculamos tu disponibilidad y te avisamos de cada evaluación."
            >
              <Button size="sm" variant={siguiente === 1 ? "default" : "outline"} asChild>
                <Link href="/cursos?nuevo=1"><Plus aria-hidden />Agregar curso</Link>
              </Button>
            </Paso>
            <Paso numero={3} hecho={pasos[2]} titulo="Crea un grupo o únete a uno" descripcion="Invita a tus compañeros por nombre y repartan el trabajo.">
              <span className="flex items-center gap-3">
                <Button size="sm" variant={siguiente === 2 && !datos.invitacionesPendientes ? "default" : "outline"} asChild>
                  <Link href="/grupos?nuevo=1">Crear grupo</Link>
                </Button>
                <Link
                  href="/notificaciones?filtro=invitaciones"
                  className={cn("text-[13px] hover:text-foreground", datos.invitacionesPendientes ? "font-medium text-foreground underline underline-offset-2" : "text-muted-foreground")}
                >
                  {datos.invitacionesPendientes
                    ? `Tienes ${datos.invitacionesPendientes === 1 ? "1 invitación" : `${datos.invitacionesPendientes} invitaciones`}`
                    : "Tengo una invitación"}
                </Link>
              </span>
            </Paso>
          </ol>

          <div className="mt-7 flex flex-wrap items-center gap-3 rounded-[10px] border px-4 py-3.5 text-[13px] text-muted-foreground">
            {datos.visibleEnBusqueda ? <Eye className="size-4 shrink-0" aria-hidden /> : <EyeOff className="size-4 shrink-0" aria-hidden />}
            <span className="min-w-[220px] flex-1">
              {datos.visibleEnBusqueda
                ? "Apareces en la búsqueda de personas para que te puedan invitar."
                : "No apareces en la búsqueda: solo te pueden invitar quienes ya comparten un grupo contigo."}
            </span>
            <Link href="/perfil" className="hover:text-foreground">Ver perfil</Link>
          </div>

          <form action={ocultarBienvenidaAction} className="mt-4">
            <button type="submit" className="text-[13px] text-subtle-foreground underline-offset-2 hover:text-foreground hover:underline">
              Ocultar esta guía
            </button>
          </form>
        </div>

        <aside className="min-w-0 flex-[1_1_280px] rounded-[14px] border p-5" aria-label="Vista previa de tu semana">
          <p className="text-sm font-medium">Así se verá tu semana</p>
          <p className="mt-1.5 mb-4 text-[13px] leading-normal text-subtle-foreground">
            {datos.sesiones.length ? "Tus clases de lunes a viernes. El resto lo ves en el Calendario." : "Cuando agregues tus cursos, aquí aparecerán tus clases."}
          </p>
          <div className="relative grid h-44 grid-cols-5 gap-1.5">
            {DIAS.map((dia) => <div key={dia} className="rounded-[5px] bg-muted" />)}
            {(datos.sesiones.length ? datos.sesiones : null)?.map((sesion, indice) => (
              <span
                key={indice}
                className="absolute rounded-[5px] border"
                style={{
                  left: `calc((100% - 24px) / 5 * ${sesion.diaSemana - 1} + ${(sesion.diaSemana - 1) * 6}px + 2px)`,
                  width: "calc((100% - 24px) / 5 - 4px)",
                  top: `${((Math.max(sesion.inicioMin, DESDE) - DESDE) / (HASTA - DESDE)) * 100}%`,
                  height: `${((Math.min(sesion.finMin, HASTA) - Math.max(sesion.inicioMin, DESDE)) / (HASTA - DESDE)) * 100}%`,
                  background: `color-mix(in srgb, ${colorCurso(sesion.idCurso)} 22%, transparent)`,
                  borderColor: `color-mix(in srgb, ${colorCurso(sesion.idCurso)} 45%, transparent)`,
                }}
              />
            )) ??
              MARCADORES.map((marcador, indice) => (
                <span
                  key={indice}
                  className="absolute rounded-[5px] border border-dashed border-input bg-secondary"
                  style={{
                    left: `calc((100% - 24px) / 5 * ${marcador.dia - 1} + ${(marcador.dia - 1) * 6}px + 2px)`,
                    width: "calc((100% - 24px) / 5 - 4px)",
                    top: `${((marcador.desde - DESDE) / (HASTA - DESDE)) * 100}%`,
                    height: `${((marcador.hasta - marcador.desde) / (HASTA - DESDE)) * 100}%`,
                  }}
                />
              ))}
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1.5 text-center text-[11px] text-subtle-foreground">
            {DIAS.map((dia) => <span key={dia}>{dia}</span>)}
          </div>
        </aside>
      </div>
    </section>
  );
}
