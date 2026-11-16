"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type Variants } from "motion/react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Logotipo } from "@/components/marca/monograma";
import { StatusIcon } from "@/components/ui-app/status-icon";
import type { EstadoTarea } from "@/lib/estado-tarea";
import { cn } from "@/lib/utils";

const ENTRADA: Variants = {
  oculto: { opacity: 0, y: 14 },
  visible: (indice: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: 0.08 * indice, ease: [0.22, 1, 0.36, 1] } }),
};

/** Ritmo de la demo: cada "paso" avanza tareas, horarios y revisiones a la vez. */
const PASO_MS = 2400;

function usePaso(activo: boolean) {
  const [paso, setPaso] = useState(0);
  useEffect(() => {
    if (!activo) return;
    const intervalo = window.setInterval(() => setPaso((actual) => actual + 1), PASO_MS);
    return () => window.clearInterval(intervalo);
  }, [activo]);
  return paso;
}

export function LoginC({ error, fuenteGoogle }: { error?: string; fuenteGoogle: string }) {
  const reducir = useReducedMotion() ?? false;
  const paso = usePaso(!reducir);

  return (
    <div className="flex min-h-dvh flex-col bg-muted text-foreground dark:bg-background">
      <header className="flex items-center justify-between px-5 py-5 sm:px-14 sm:py-6">
        <Logotipo />
        <BotonTema />
      </header>

      <main className="flex flex-1 flex-wrap items-center gap-12 px-5 pt-4 pb-12 sm:px-14 lg:gap-16 lg:pb-14">
        <motion.div initial="oculto" animate="visible" className="max-w-[520px] flex-[1_1_420px]">
          <motion.div
            variants={ENTRADA}
            custom={0}
            className="inline-flex h-7 items-center gap-2 rounded-full bg-card px-3 text-xs text-muted-foreground shadow-[var(--shadow-xs)] dark:border"
          >
            <span className="relative flex size-[7px]">
              {reducir ? null : <span className="absolute inset-0 animate-ping rounded-[2px] bg-estado-completada opacity-60" aria-hidden />}
              <span className="relative size-[7px] rounded-[2px] bg-estado-completada" aria-hidden />
            </span>
            Para trabajos grupales universitarios
          </motion.div>
          <motion.h1 variants={ENTRADA} custom={1} className="mt-6 text-[44px] leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-[56px]">
            Tu grupo,
            <br />
            al día.
          </motion.h1>
          <motion.p variants={ENTRADA} custom={2} className="mt-5 mb-8 max-w-[440px] text-[17px] leading-relaxed text-muted-foreground">
            Reparte las tareas, revisa lo que hace cada uno y encuentra cuándo reunirse, sin perseguir a nadie por WhatsApp.
          </motion.p>

          <motion.div variants={ENTRADA} custom={3} className="w-[340px] max-w-full">
            {error ? (
              <p role="alert" className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                {error}
              </p>
            ) : null}
            <motion.a
              href="/api/auth/google"
              whileHover={reducir ? undefined : { y: -1 }}
              whileTap={reducir ? undefined : { scale: 0.98 }}
              className={cn(
                fuenteGoogle,
                "flex h-11 w-full items-center justify-center gap-2.5 rounded-full border px-3 text-sm font-medium shadow-[0_1px_2px_rgba(24,24,27,0.06)] transition-[background-color,box-shadow] hover:shadow-[0_2px_8px_rgba(24,24,27,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                // Guía de marca de Google: claro (#fff, borde #747775) y oscuro (#131314, borde #8e918f).
                "border-[#747775] bg-white text-[#1f1f1f] hover:bg-[#f8f9fa] dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f20]",
              )}
            >
              <LogoGoogle />
              Continuar con Google
            </motion.a>
          </motion.div>
          <motion.p variants={ENTRADA} custom={4} className="mt-3.5 max-w-[400px] text-xs leading-relaxed text-subtle-foreground">
            La primera vez creamos tu cuenta con tu nombre, correo y foto de Google. No pedimos acceso a tu Gmail ni a tu calendario.
          </motion.p>
        </motion.div>

        <Bento reducir={reducir} paso={paso} />
      </main>

      <footer className="px-5 pb-6 text-xs text-subtle-foreground sm:px-14">© {new Date().getFullYear()} EduControl</footer>
    </div>
  );
}

function BotonTema() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="relative grid size-9 place-items-center overflow-hidden rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="Cambiar entre tema claro y oscuro"
      title="Tema claro u oscuro"
    >
      <Sun className="size-[18px] transition-transform duration-500 dark:-rotate-90 dark:scale-0" aria-hidden />
      <Moon className="absolute size-[18px] scale-0 rotate-90 transition-transform duration-500 dark:scale-100 dark:rotate-0" aria-hidden />
    </button>
  );
}

/** Tarjetas del producto con una leve inclinación que sigue al puntero (no en táctil ni con movimiento reducido). */
function Bento({ reducir, paso }: { reducir: boolean; paso: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [3, -3]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-4, 4]), { stiffness: 150, damping: 20 });

  function mover(evento: ReactPointerEvent<HTMLDivElement>) {
    if (reducir || evento.pointerType !== "mouse") return;
    const caja = evento.currentTarget.getBoundingClientRect();
    x.set((evento.clientX - caja.left) / caja.width - 0.5);
    y.set((evento.clientY - caja.top) / caja.height - 0.5);
  }

  return (
    <div className="flex-[1_1_480px] [perspective:1400px]" onPointerMove={mover} onPointerLeave={() => { x.set(0); y.set(0); }}>
      <motion.div
        style={reducir ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        initial="oculto"
        animate="visible"
        className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
        aria-label="Así se ve EduControl"
        role="img"
      >
        <Tarjeta indice={2} titulo="Tareas del grupo"><TareasVivas paso={paso} reducir={reducir} /></Tarjeta>
        <Tarjeta indice={3} titulo="Mejor horario para reunirse"><HorarioVivo paso={paso} reducir={reducir} /></Tarjeta>
        <Tarjeta indice={4} titulo="Revisión entre compañeros" className="sm:col-span-2"><RevisionViva paso={paso} reducir={reducir} /></Tarjeta>
      </motion.div>
    </div>
  );
}

function Tarjeta({ titulo, indice, className, children }: { titulo: string; indice: number; className?: string; children: ReactNode }) {
  return (
    <motion.div
      variants={ENTRADA}
      custom={indice}
      className={cn("flex flex-col gap-3 rounded-2xl bg-card p-[18px] shadow-[var(--shadow-xs)] dark:border", className)}
    >
      <div className="text-xs text-subtle-foreground">{titulo}</div>
      {children}
    </motion.div>
  );
}

const TAREAS: { titulo: string; iniciales: string; tono: string; ciclo: EstadoTarea[] }[] = [
  { titulo: "Mockups del login", iniciales: "SS", tono: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200", ciclo: ["en_revision", "completada", "completada", "completada"] },
  { titulo: "Diagrama de clases", iniciales: "RC", tono: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200", ciclo: ["en_progreso", "en_progreso", "en_revision", "completada"] },
  { titulo: "Documento del Avance 4", iniciales: "AT", tono: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", ciclo: ["pendiente", "en_progreso", "en_progreso", "en_revision"] },
];
const PESO: Record<EstadoTarea, number> = { pendiente: 0, en_progreso: 0.35, en_revision: 0.75, completada: 1, descartada: 0 };

function TareasVivas({ paso, reducir }: { paso: number; reducir: boolean }) {
  const fase = paso % 4;
  const avance = Math.round((TAREAS.reduce((suma, tarea) => suma + PESO[tarea.ciclo[fase]], 0) / TAREAS.length) * 100);
  return (
    <div className="flex flex-col gap-2.5">
      {TAREAS.map((tarea) => {
        const estado = tarea.ciclo[fase];
        return (
          <div key={tarea.titulo} className="flex items-center gap-2 text-[13px]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={estado}
                initial={reducir ? false : { scale: 0.4, opacity: 0, rotate: -45 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                className="flex"
              >
                <StatusIcon estado={estado} className="size-3.5" />
              </motion.span>
            </AnimatePresence>
            <span className={cn("flex-1 truncate transition-colors duration-500", estado === "completada" && "text-muted-foreground")}>{tarea.titulo}</span>
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-medium", tarea.tono)}>{tarea.iniciales}</span>
          </div>
        );
      })}
      <div className="mt-1 flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <motion.div className="h-full rounded-full bg-estado-completada" animate={{ width: `${avance}%` }} transition={{ type: "spring", stiffness: 90, damping: 18 }} />
        </div>
        <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{avance}%</span>
      </div>
    </div>
  );
}

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie"];
/** Libres por franja (0 a 4) en tres semanas distintas; la columna con más verde es la sugerida. */
const SEMANAS = [
  [[4, 4, 2, 0, 4], [4, 4, 4, 4, 2], [4, 1, 4, 4, 4], [4, 4, 2, 2, 4], [4, 4, 4, 4, 4]],
  [[2, 4, 4, 1, 4], [4, 4, 4, 4, 4], [1, 4, 4, 2, 4], [4, 4, 4, 4, 2], [2, 4, 4, 1, 4]],
  [[4, 2, 1, 4, 4], [2, 4, 2, 4, 4], [4, 4, 4, 4, 4], [4, 1, 2, 4, 4], [4, 4, 4, 4, 4]],
];
const SUGERENCIAS = ["Vie 21 · 9:00am - 7:00pm", "Mar 25 · 8:00am - 6:00pm", "Mié 3 · 10:00am - 8:00pm"];

function HorarioVivo({ paso, reducir }: { paso: number; reducir: boolean }) {
  const semana = Math.floor(paso / 2) % SEMANAS.length;
  const mapa = SEMANAS[semana];
  const mejor = mapa.map((fila) => fila.reduce((suma, libres) => suma + libres, 0)).reduce((mejorIndice, total, indice, totales) => (total > totales[mejorIndice] ? indice : mejorIndice), 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-1" aria-hidden>
        {DIAS.map((dia, indice) => (
          <span key={dia} className={cn("text-center text-[10px] text-subtle-foreground transition-colors", indice === mejor && "font-medium text-foreground")}>{dia}</span>
        ))}
        {Array.from({ length: 5 }, (_, franja) =>
          mapa.map((columna, dia) => {
            const libres = columna[franja];
            return (
              <motion.span
                key={`${dia}-${franja}`}
                className={cn("h-3.5 rounded-[3px]", dia === mejor && "ring-1 ring-estado-completada/40")}
                animate={{ backgroundColor: libres === 4 ? "color-mix(in srgb, var(--estado-completada) 55%, transparent)" : libres >= 2 ? "color-mix(in srgb, var(--estado-completada) 18%, transparent)" : "var(--secondary)" }}
                transition={{ duration: reducir ? 0 : 0.6, delay: reducir ? 0 : (dia + franja) * 0.035 }}
              />
            );
          }),
        )}
      </div>
      <div className="relative h-5 overflow-hidden text-[13px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={semana}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 truncate"
          >
            {SUGERENCIAS[semana]} <span className="text-estado-completada">· todos libres</span>
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

const REVISIONES = [
  { quien: "Rodolfo", iniciales: "RC", tono: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200", accion: "te devolvió “Creación del documento”", nota: "Falta el diagrama de despliegue." },
  { quien: "Ana", iniciales: "AT", tono: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", accion: "aprobó “Mockups del login”", nota: "Quedó claro, ya lo subo al Drive." },
  { quien: "Sebastián", iniciales: "SS", tono: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200", accion: "envió a revisión “Diagrama de clases”", nota: "Revisen las relaciones de Grupo y Tarea." },
];

function RevisionViva({ paso, reducir }: { paso: number; reducir: boolean }) {
  const revision = REVISIONES[Math.floor(paso / 3) % REVISIONES.length];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={revision.quien}
        initial={reducir ? false : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-start gap-2.5"
      >
        <span className={cn("grid size-[26px] shrink-0 place-items-center rounded-full text-[10px] font-medium", revision.tono)}>{revision.iniciales}</span>
        <div className="min-w-0 flex-1 text-[13px] leading-snug">
          {revision.quien} {revision.accion}
          <div className="mt-1.5 rounded-lg bg-secondary px-2.5 py-2 text-muted-foreground">
            “<Escritura texto={revision.nota} reducir={reducir} />”
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Texto que se escribe letra por letra, con cursor. */
function Escritura({ texto, reducir }: { texto: string; reducir: boolean }) {
  const [letras, setLetras] = useState(reducir ? texto.length : 0);
  useEffect(() => {
    if (reducir) return;
    const intervalo = window.setInterval(() => setLetras((actual) => (actual >= texto.length ? actual : actual + 1)), 28);
    return () => window.clearInterval(intervalo);
  }, [texto, reducir]);
  const escribiendo = letras < texto.length;
  return (
    <>
      {texto.slice(0, letras)}
      {escribiendo ? <span className="ml-px inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-current" aria-hidden /> : null}
    </>
  );
}

function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}
