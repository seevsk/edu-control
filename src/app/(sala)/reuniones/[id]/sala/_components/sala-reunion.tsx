"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, CircleAlert, ExternalLink, MoreHorizontal, PhoneOff, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { AVISO_CIERRE_MIN, minutosHasta } from "@/lib/estado-reunion";
import { aOracion } from "@/lib/presentacion";
import { cn } from "@/lib/utils";
import { cerrarSiVencioAction, finalizarReunionAction } from "@/app/(app)/reuniones/actions";
import { CourseDot } from "@/components/ui-app/course-dot";
import { DialogoConfirmarReunion } from "@/components/ui-app/reuniones/dialogo-confirmar-reunion";
import { EstadoReunion } from "@/components/ui-app/reuniones/estado-reunion";
import { PuntoEnCurso } from "@/components/ui-app/reuniones/punto-en-curso";
import { useAhora } from "@/components/ui-app/reuniones/reloj";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { BOTON_ESTADO, EnlaceEstado, MarcoEstadoSala } from "./marco-estado-sala";

export type CredencialesCliente = { tipo: "livekit"; serverUrl: string; token: string } | { tipo: "simulado" };

// LiveKit solo corre en el navegador: se carga aparte, con un esqueleto del área de video mientras tanto.
const VideoLiveKit = dynamic(() => import("./video-livekit"), {
  ssr: false,
  loading: () => (
    <div role="status" aria-label="Cargando" className="grid h-full grid-cols-1 gap-2 bg-[#0b0b0c] p-2 md:grid-cols-2">
      <Skeleton className="h-full rounded-lg bg-white/10" />
      <Skeleton className="hidden h-full rounded-lg bg-white/10 md:block" />
    </div>
  ),
});

const MS_MIN = 60_000;

/** Sala de la reunión (P6): marco de EduControl alrededor de la llamada de LiveKit. */
export function SalaReunion({
  idReunion,
  titulo,
  grupo,
  credenciales,
  cierre,
  ahoraInicial,
  moderador,
  iniciadoPor,
}: {
  idReunion: number;
  titulo: string;
  grupo: { nombre: string; idCurso: number | null };
  credenciales: CredencialesCliente;
  cierre: Date;
  ahoraInicial: string;
  moderador: boolean;
  /** Otra persona ya había iniciado la reunión (llegó con "Reunirse ahora"). */
  iniciadoPor: string | null;
}) {
  const router = useRouter();
  const ahora = useAhora(ahoraInicial, 5000);
  const [finalizando, setFinalizando] = useState(false);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const conError = useRef(false);
  const detalle = `/reuniones/${idReunion}`;

  const restante = minutosHasta(cierre, ahora);
  const porCerrar = ahora.getTime() >= cierre.getTime() - AVISO_CIERRE_MIN * MS_MIN;
  const vencida = ahora.getTime() >= cierre.getTime();

  // Al llegar a cero la sala ya se cerró: se confirma en el servidor y se vuelve al detalle.
  useEffect(() => {
    if (!vencida) return;
    cerrarSiVencioAction(idReunion).finally(() => router.push(detalle));
  }, [vencida, idReunion, detalle, router]);

  // Aviso "ya había iniciado": una vez, y se quita de la URL sin recargar (el token no debe renovarse).
  useEffect(() => {
    if (!iniciadoPor) return;
    toast(`${iniciadoPor} ya había iniciado la reunión`, { id: "ya-iniciada" });
    const url = new URL(window.location.href);
    url.searchParams.delete("ya");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [iniciadoPor]);

  function abrirEnPestanaNueva() {
    window.open(`/reuniones/${idReunion}/sala`, "_blank", "noopener,noreferrer");
    // La pestaña actual vuelve al detalle: así no queda conectada dos veces.
    router.push(detalle);
  }

  function alError() {
    conError.current = true;
    setError(true);
  }

  function alDesconectar() {
    if (!conError.current) router.push(detalle);
  }

  function reintentar() {
    conError.current = false;
    setError(false);
    setIntento((n) => n + 1);
  }

  if (error) {
    return (
      <MarcoEstadoSala idReunion={idReunion} titulo={titulo} grupo={grupo} icono={<CircleAlert className="text-destructive" aria-hidden />} texto="No se pudo conectar a la videollamada.">
        <Button type="button" onClick={reintentar} className={BOTON_ESTADO}>
          <RotateCw aria-hidden />
          Reintentar
        </Button>
        <EnlaceEstado href={detalle}>Volver</EnlaceEstado>
      </MarcoEstadoSala>
    );
  }

  return (
    <>
      <header className="flex shrink-0 items-center gap-1 border-b bg-background pr-1 pl-1 max-md:min-h-12 max-md:pt-[env(safe-area-inset-top)] md:grid md:h-[52px] md:grid-cols-[1fr_auto_1fr] md:gap-0 md:pr-3 md:pl-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none">
          <Link href={detalle} aria-label="Volver al detalle" className="flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-secondary md:size-9">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="min-w-0 truncate text-[15px] font-semibold md:text-sm">{titulo}</h1>
          <span className="hidden min-w-0 items-center gap-2 text-[13px] text-muted-foreground md:inline-flex">
            {grupo.idCurso !== null ? <CourseDot idCurso={grupo.idCurso} className="size-[7px]" /> : null}
            <span className="truncate">{aOracion(grupo.nombre)}</span>
          </span>
        </div>

        <div role="status" className="flex shrink-0 items-center justify-center">
          {porCerrar ? (
            <EstadoReunion estado="por_cerrar" minutos={restante} />
          ) : (
            <span className="flex items-center gap-2 text-xs whitespace-nowrap md:text-[13px]">
              <PuntoEnCurso tamano={8} />
              <span className="hidden font-semibold text-cat-reunion-fg md:inline">En curso</span>
              <span className="text-muted-foreground">
                <span className="hidden md:inline">· </span>Cierra en {restante} min
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <Button type="button" variant="ghost" onClick={abrirEnPestanaNueva} aria-label="Abrir en pestaña nueva" className="h-8 text-[13px] text-muted-foreground">
              <ExternalLink aria-hidden />
              <span className="max-lg:sr-only">Abrir en pestaña nueva</span>
            </Button>
            {moderador ? (
              <Button type="button" variant="outline" onClick={() => setFinalizando(true)} className="h-8 border-destructive/45 bg-transparent text-[13px] font-medium text-destructive hover:bg-destructive/10 hover:text-destructive">
                Finalizar para todos
              </Button>
            ) : null}
            <Link href={detalle} className={cn(buttonVariants(), "h-8 text-[13px] font-semibold")}>
              <PhoneOff aria-hidden />
              Salir
            </Link>
          </div>
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Más acciones de la llamada" className="size-11 rounded-full">
                  <MoreHorizontal className="size-5" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[250px] rounded-[14px] p-1.5">
                <DropdownMenuItem onSelect={abrirEnPestanaNueva} className="h-[46px] text-[15px]">
                  <ExternalLink aria-hidden />
                  Abrir en pestaña nueva
                </DropdownMenuItem>
                {moderador ? (
                  <DropdownMenuItem variant="destructive" onSelect={() => setFinalizando(true)} className="h-[46px] text-[15px]">
                    <X aria-hidden />
                    Finalizar para todos
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => router.push(detalle)} className="h-[46px] text-[15px]">
                  <PhoneOff aria-hidden />
                  Salir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 bg-[#101012] p-3.5 max-md:p-2.5 max-md:pb-[calc(1.875rem+env(safe-area-inset-bottom))]">
        <div className="h-full overflow-hidden">
          {credenciales.tipo === "livekit" ? (
            <VideoLiveKit key={intento} serverUrl={credenciales.serverUrl} token={credenciales.token} alDesconectar={alDesconectar} alError={alError} />
          ) : (
            <div className="grid h-full place-items-center bg-muted text-sm text-muted-foreground">Videollamada simulada</div>
          )}
        </div>
      </main>

      <DialogoConfirmarReunion
        abierto={finalizando}
        alCambiar={setFinalizando}
        titulo="¿Finalizar la reunión para todos?"
        confirmar="Finalizar"
        accion={finalizarReunionAction.bind(null, idReunion)}
      />
    </>
  );
}
