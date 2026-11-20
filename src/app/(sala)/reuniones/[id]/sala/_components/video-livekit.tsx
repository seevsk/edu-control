"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { ConnectionState, Track } from "livekit-client";
import {
  DisconnectButton,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  PreJoin,
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  useConnectionState,
  useTracks,
  type PreJoinProps,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { useEsMovil } from "@/hooks/use-es-movil";
import { Skeleton } from "@/components/ui/skeleton";

// Colores y medidas del tablero: fondo #101012, mosaicos #1b1b1e de 12 px de radio y 10 px de separación.
const TEMA_VIDEO = { "--lk-bg": "#101012", "--lk-bg2": "#1b1b1e", "--lk-border-radius": "12px", "--lk-grid-gap": "10px" } as CSSProperties;

type Eleccion = Parameters<NonNullable<PreJoinProps["onSubmit"]>>[0];

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
      <ParticipantTile />
    </GridLayout>
  );
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
      <TrackToggle source={Track.Source.Microphone} showIcon>
        <span className="max-md:sr-only">Micrófono</span>
      </TrackToggle>
      <TrackToggle source={Track.Source.Camera} showIcon>
        <span className="max-md:sr-only">Cámara</span>
      </TrackToggle>
      {movil ? null : (
        <TrackToggle source={Track.Source.ScreenShare} showIcon>
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
}: {
  serverUrl: string;
  token: string;
  alDesconectar: () => void;
  alError: () => void;
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
      onError={alError}
      onMediaDeviceFailure={() => toast.error("No se pudo usar la cámara o el micrófono.", { id: "falla-dispositivo" })}
    >
      <div className="relative min-h-0 flex-1">
        <Mosaicos />
        <Conectando />
      </div>
      <RoomAudioRenderer />
      <StartAudio label="Activar audio" />
      <Controles />
    </LiveKitRoom>
  );
}
