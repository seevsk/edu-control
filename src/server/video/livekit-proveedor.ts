import { SignJWT } from "jose";
import { ErrorDeNegocio } from "@/lib/errores";
import { env } from "@/lib/env";
import type { CredencialesSala, ProveedorVideo } from "./proveedor-video";

const MS_SEG = 1000;

type Credenciales = { url: string; apiKey: string; apiSecret: string };

function credenciales(): Credenciales {
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new ErrorDeNegocio("No se pudo crear la videollamada.");
  }
  return { url: env.LIVEKIT_URL, apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET };
}

/** Los tokens se firman con HS256 usando el secreto de la API como clave. */
async function firmar(
  c: Credenciales,
  claims: Record<string, unknown>,
  opciones: { identidad?: string; desde?: Date; hasta: Date },
) {
  let jwt = new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuer(c.apiKey);
  if (opciones.identidad) jwt = jwt.setSubject(opciones.identidad);
  if (opciones.desde) jwt = jwt.setNotBefore(Math.floor(opciones.desde.getTime() / MS_SEG));
  return jwt.setExpirationTime(Math.floor(opciones.hasta.getTime() / MS_SEG)).sign(new TextEncoder().encode(c.apiSecret));
}

/** Llama a RoomService (Twirp sobre HTTP). Devuelve el codigo HTTP y el cuerpo; nunca registra secretos. */
async function llamarRoomServiceConCuerpo(
  metodo: "CreateRoom" | "DeleteRoom" | "ListParticipants",
  cuerpo: Record<string, unknown>,
  sala?: string,
) {
  const c = credenciales();
  // roomAdmin + room permiten listar los participantes de esa sala; roomCreate crea y borra salas.
  const permisos = sala ? { roomCreate: true, roomAdmin: true, room: sala } : { roomCreate: true };
  const token = await firmar(c, { video: permisos }, { hasta: new Date(Date.now() + 60 * MS_SEG) });
  const host = c.url.replace(/^wss:\/\//, "https://");
  const respuesta = await fetch(`${host}/twirp/livekit.RoomService/${metodo}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(10_000),
  });
  const texto = await respuesta.text().catch(() => "");
  return { estado: respuesta.status, texto };
}

async function llamarRoomService(metodo: "CreateRoom" | "DeleteRoom", cuerpo: Record<string, unknown>) {
  return (await llamarRoomServiceConCuerpo(metodo, cuerpo)).estado;
}

async function cerrar(sala: string) {
  const estado = await llamarRoomService("DeleteRoom", { room: sala });
  // Twirp responde 404 (not_found) si la sala no existe: se trata como exito.
  if (estado !== 200 && estado !== 404) {
    console.error(`[video] LiveKit DeleteRoom respondio ${estado}`);
    throw new Error("No se pudo cerrar la sala");
  }
}

export class LiveKitProveedor implements ProveedorVideo {
  async crearSala(datos: { nombre: string }): Promise<string> {
    let estado: number;
    try {
      estado = await llamarRoomService("CreateRoom", { name: datos.nombre, emptyTimeout: 600, maxParticipants: 20 });
    } catch {
      console.error("[video] LiveKit CreateRoom no respondio");
      throw new ErrorDeNegocio("No se pudo crear la videollamada.");
    }
    if (estado !== 200) {
      console.error(`[video] LiveKit CreateRoom respondio ${estado}`);
      throw new ErrorDeNegocio("No se pudo crear la videollamada.");
    }
    return datos.nombre;
  }

  async credencialesDeEntrada(datos: {
    sala: string;
    idUsuario: number;
    nombre: string;
    moderador: boolean;
    abre: Date;
    cierra: Date;
  }): Promise<CredencialesSala> {
    const c = credenciales();
    const token = await firmar(
      c,
      {
        name: datos.nombre,
        video: {
          room: datos.sala,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          roomAdmin: datos.moderador,
        },
      },
      { identidad: String(datos.idUsuario), desde: datos.abre, hasta: datos.cierra },
    );
    return { tipo: "livekit", serverUrl: c.url, token };
  }

  cerrarSala(sala: string) {
    return cerrar(sala);
  }

  borrarSala(sala: string) {
    return cerrar(sala);
  }

  async participantesConectados(sala: string): Promise<number | null> {
    try {
      const { estado, texto } = await llamarRoomServiceConCuerpo("ListParticipants", { room: sala }, sala);
      // Twirp responde 404 (not_found) si la sala ya no existe: nadie esta conectado.
      if (estado === 404) return 0;
      if (estado !== 200) {
        console.error(`[video] LiveKit ListParticipants respondio ${estado}`);
        return null;
      }
      const datos = JSON.parse(texto) as { participants?: unknown[] };
      return Array.isArray(datos.participants) ? datos.participants.length : 0;
    } catch {
      console.error("[video] LiveKit ListParticipants no respondio");
      return null;
    }
  }
}
