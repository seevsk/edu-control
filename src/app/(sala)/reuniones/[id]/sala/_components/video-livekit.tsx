"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ConnectionState, MediaDeviceFailure, RoomEvent, Track } from "livekit-client";
import {
  DisconnectButton,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  PreJoin,
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  VideoTrack,
  isTrackReference,
  useConnectionState,
  useRoomContext,
  useTrackRefContext,
  useTracks,
  type PreJoinProps,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { useEsMovil } from "@/hooks/use-es-movil";
import { colorAvatar, iniciales } from "@/lib/presentacion";
import { nombrePila } from "@/lib/nombres";
import { Skeleton } from "@/components/ui/skeleton";

// Colores y medidas del tablero: fondo #101012, mosaicos #1b1b1e de 12 px de radio y 10 px de separación.
const TEMA_VIDEO = { "--lk-bg": "#101012", "--lk-bg2": "#1b1b1e", "--lk-border-radius": "12px", "--lk-grid-gap": "10px" } as CSSProperties;

type Eleccion = Parameters<NonNullable<PreJoinProps["onSubmit"]>>[0];

/** Lo que la sala necesita de la conexion: desconectar y saber cuantas personas mas hay dentro. */
export interface AccionesSala {
  salir: () => Promise<void>;
  /** Ultimo conteo conocido de los demas participantes (no se pierde al desconectar). */
  remotos: () => number;
}

// Errores del navegador al abrir la camara o el microfono. LiveKit los reenvia por `onError`, pero
// no son fallos de conexion: la persona puede entrar igual y activar los dispositivos despues.
const ERRORES_DE_DISPOSITIVO = new Set([
  "NotFoundError",
  "DevicesNotFoundError",
  "NotAllowedError",
  "PermissionDeniedError",
  "SecurityError",
  "NotReadableError",
  "TrackStartError",
  "OverconstrainedError",
  "AbortError",
]);

function esFalloDeDispositivo(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    ERRORES_DE_DISPOSITIVO.has(error.name) ||
    /getUserMedia|video source|audio source|permission denied|requested device not found/i.test(error.message)
  );
}

function avisarFalloDeDispositivo(falla: MediaDeviceFailure | undefined) {
  const mensajes: Record<MediaDeviceFailure, string> = {
    [MediaDeviceFailure.DeviceInUse]:
      "La cámara o el micrófono está en uso por otra aplicación (por ejemplo, una llamada de Meet). Entraste sin ellos: actívalos cuando se liberen.",
    [MediaDeviceFailure.PermissionDenied]: "Permite el acceso a la cámara y al micrófono en tu navegador para que te vean y te escuchen.",
    [MediaDeviceFailure.NotFound]: "No se encontró una cámara o un micrófono.",
    [MediaDeviceFailure.Other]: "No se pudo usar la cámara o el micrófono.",
  };
  toast.error(mensajes[falla ?? MediaDeviceFailure.Other], { id: "falla-dispositivo", duration: 9000 });
}

function avisarError(error: Error) {
  avisarFalloDeDispositivo(MediaDeviceFailure.getFailure(error));
}

/** Contenido de cada mosaico: video si hay cámara; si no, círculo de color con iniciales (como Avatar). Rótulo "Tú" o nombre de pila. */
function ContenidoMosaico() {
  const referencia = useTrackRefContext();
  const { participant } = referencia;
  const conVideo = isTrackReference(referencia) && !referencia.publication.isMuted;
  const pantalla = referencia.source === Track.Source.ScreenShare;
  const nombre = participant.name || "Participante";
  const rotulo = participant.isLocal ? "Tú" : nombrePila(nombre);
  const idUsuario = Number(participant.identity);
  return (
    <>
      {conVideo ? (
        <VideoTrack trackRef={referencia} />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span
            aria-hidden
            style={colorAvatar(Number.isFinite(idUsuario) ? idUsuario : 0)}
            className="flex size-[72px] items-center justify-center rounded-full text-2xl font-medium lg:size-24 lg:text-3xl"
          >
            {iniciales(nombre)}
          </span>
        </div>
      )}
      <span className="absolute bottom-2.5 left-2.5 rounded-md bg-black/55 px-2 py-0.5 text-xs text-zinc-100">
        {pantalla ? `Pantalla de ${rotulo}` : rotulo}
      </span>
    </>
  );
}

function Mosaicos() {
  const pistas = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={pistas} style={{ height: "100%" }}>
      <ParticipantTile className="relative overflow-hidden rounded-xl bg-[#1b1b1e]">
        <ContenidoMosaico />
      </ParticipantTile>
    </GridLayout>
  );
}

/**
 * Entrega a la sala la función para desconectar el cliente antes de que el servidor borre la sala,
 * y el conteo de los demás participantes (al desconectar LiveKit vacía la lista, por eso se guarda).
 */
function RegistroSalida({ registrar }: { registrar?: (acciones: AccionesSala | null) => void }) {
  const sala = useRoomContext();
  const remotos = useRef(0);
  useEffect(() => {
    const actualizar = () => {
      if (sala.state === ConnectionState.Connected) remotos.current = sala.remoteParticipants.size;
    };
    actualizar();
    sala.on(RoomEvent.Connected, actualizar).on(RoomEvent.ParticipantConnected, actualizar).on(RoomEvent.ParticipantDisconnected, actualizar);
    registrar?.({ salir: () => sala.disconnect(), remotos: () => remotos.current });
    return () => {
      sala.off(RoomEvent.Connected, actualizar).off(RoomEvent.ParticipantConnected, actualizar).off(RoomEvent.ParticipantDisconnected, actualizar);
      registrar?.(null);
    };
  }, [sala, registrar]);
  return null;
}

function Conectando() {
  const estado = useConnectionState();
  if (estado === ConnectionState.Connected) return null;
  return (
    <div role="status" aria-label="Conectando" className="absolute inset-0 z-10 grid grid-cols-1 gap-2 bg-[#101012] p-2 md:grid-cols-2">
      <Skeleton className="h-full min-h-24 rounded-lg bg-white/10" />
      <Skeleton className="hidden h-full rounded-lg bg-white/10 md:block" />
    </div>
  );
}

/** Controles propios en español (sin chat). En móvil, solo íconos y sin compartir pantalla. */
function Controles() {
  const movil = useEsMovil();
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 p-2.5">
      <TrackToggle source={Track.Source.Microphone} showIcon onDeviceError={avisarError}>
        <span className="max-md:sr-only">Micrófono</span>
      </TrackToggle>
      <TrackToggle source={Track.Source.Camera} showIcon onDeviceError={avisarError}>
        <span className="max-md:sr-only">Cámara</span>
      </TrackToggle>
      {movil ? null : (
        <TrackToggle source={Track.Source.ScreenShare} showIcon onDeviceError={avisarError}>
          Compartir pantalla
        </TrackToggle>
      )}
      <DisconnectButton>
        <PhoneOff className="size-4" aria-hidden />
        <span className="max-md:sr-only">Salir</span>
      </DisconnectButton>
    </div>
  );
}

/**
 * Vista previa (cámara y micrófono) y luego la sala de LiveKit, compuestas con piezas de
 * `@livekit/components-react` para que todos los textos salgan en español. El nombre sale del
 * token del servidor: por eso se oculta el campo de nombre de la vista previa.
 */
export default function VideoLiveKit({
  serverUrl,
  token,
  alDesconectar,
  alError,
  registrarSalida,
}: {
  serverUrl: string;
  token: string;
  alDesconectar: () => void;
  alError: () => void;
  registrarSalida?: (acciones: AccionesSala | null) => void;
}) {
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);

  if (!eleccion) {
    return (
      <div data-lk-theme="default" className="grid h-full place-items-center overflow-auto bg-[#101012] p-4">
        <PreJoin
          joinLabel="Unirse"
          micLabel="Micrófono"
          camLabel="Cámara"
          userLabel="Nombre"
          defaults={{ username: "participante" }}
          onValidate={() => true}
          onError={(error) => {
            if (esFalloDeDispositivo(error)) avisarError(error);
          }}
          onSubmit={setEleccion}
          className="w-full max-w-[480px] [&_.lk-join-button]:w-full [&_.lk-username-container]:block [&_.lk-username-container_input]:hidden"
        />
      </div>
    );
  }

  return (
    <LiveKitRoom
      data-lk-theme="default"
      style={TEMA_VIDEO}
      className="relative flex h-full flex-col overflow-hidden bg-[#101012]"
      serverUrl={serverUrl}
      token={token}
      connect
      audio={eleccion.audioEnabled ? { deviceId: eleccion.audioDeviceId || undefined } : false}
      video={eleccion.videoEnabled ? { deviceId: eleccion.videoDeviceId || undefined } : false}
      onDisconnected={alDesconectar}
      // Un fallo de cámara o micrófono (por ejemplo, ocupados por Meet) no es un fallo de conexión.
      onError={(error) => (esFalloDeDispositivo(error) ? avisarError(error) : alError())}
      onMediaDeviceFailure={avisarFalloDeDispositivo}
    >
      <div className="relative min-h-0 flex-1">
        <Mosaicos />
        <Conectando />
      </div>
      <RegistroSalida registrar={registrarSalida} />
      <RoomAudioRenderer />
      <StartAudio label="Activar audio" />
      <Controles />
    </LiveKitRoom>
  );
}
