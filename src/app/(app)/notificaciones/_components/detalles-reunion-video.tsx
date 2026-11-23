import Link from "next/link";
import type { ReactNode } from "react";
import { estadoReunion } from "@/lib/estado-reunion";
import { hora } from "@/lib/formato-fecha";
import { nombrePila } from "@/lib/nombres";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { AvataresApilados } from "@/components/ui-app/reuniones/avatares-apilados";
import { BotonUnirse } from "@/components/ui-app/reuniones/boton-unirse";
import { EstadoReunion } from "@/components/ui-app/reuniones/estado-reunion";
import { duracionEntre } from "@/components/ui-app/reuniones/formato";
import { RefrescoEnVivo } from "@/components/ui-app/reuniones/refresco-en-vivo";

type Persona = { idUsuario: number; nombre: string; apellidos: string | null; fotoUrl: string | null };

export interface ReunionVideoDetalle {
  idReunion: number;
  titulo: string;
  inicio: Date;
  fin: Date;
  videollamada: boolean;
  iniciadaEn: Date | null;
  finalizadaEn: Date | null;
  finalizador: Persona | null;
  /** Cerrada sola por sala vacia y aun dentro de la ventana: se puede volver a entrar. */
  reabrible?: boolean;
  asistentes: { fechaEntrada: Date | null; usuario: Persona }[];
}

/** Fila etiqueta-valor de 40 px con separador, como en el tablero de la Bandeja. */
function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center border-b border-border-subtle text-sm">
      <dt className="w-[130px] shrink-0 text-subtle-foreground">{etiqueta}</dt>
      <dd className="flex min-w-0 items-center gap-2">{children}</dd>
    </div>
  );
}

function PersonaFila({ persona, idUsuario }: { persona: Persona; idUsuario: number }) {
  return (
    <>
      <UserAvatar usuario={persona} tamano="md" />
      <span className="truncate">{persona.idUsuario === idUsuario ? "Tú" : nombrePila(persona.nombre)}</span>
    </>
  );
}

function Encabezado({ chip, titulo, reunion, grupo }: { chip: ReactNode; titulo: string; reunion: string; grupo: ReactNode }) {
  return (
    <div>
      {chip}
      <h2 className="mt-2.5 text-xl font-bold tracking-[-0.01em]">{titulo}</h2>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{reunion} ·</span>
        {grupo}
      </div>
    </div>
  );
}

/** Aviso `reunion_iniciada`: quién la inició, desde y hasta cuándo, y Unirse (o "Ya terminó"). */
export function DetalleReunionIniciada({
  reunion,
  grupo,
  idUsuario,
  ahora,
  puedeUnirse,
}: {
  reunion: ReunionVideoDetalle;
  grupo: ReactNode;
  idUsuario: number;
  ahora: Date;
  puedeUnirse: boolean;
}) {
  const estado = reunion.reabrible ? "en_curso" : estadoReunion(reunion, ahora);
  const terminada = estado === "terminada";
  const entradas = reunion.asistentes
    .filter((a) => a.fechaEntrada)
    .sort((a, b) => (a.fechaEntrada as Date).getTime() - (b.fechaEntrada as Date).getTime());
  const iniciador = entradas[0]?.usuario ?? null;
  return (
    <div className="flex max-w-[620px] flex-col gap-[18px]">
      {terminada ? null : <RefrescoEnVivo />}
      <Encabezado
        chip={terminada ? <EstadoReunion estado="terminada" /> : <EstadoReunion estado={estado === "por_cerrar" ? "por_cerrar" : "en_curso"} minutos={0} />}
        titulo="Reunión iniciada"
        reunion={reunion.titulo}
        grupo={grupo}
      />
      <dl>
        {iniciador ? (
          <Fila etiqueta="Iniciada por">
            <PersonaFila persona={iniciador} idUsuario={idUsuario} />
          </Fila>
        ) : null}
        <Fila etiqueta="Desde">{hora(reunion.iniciadaEn ?? reunion.inicio)}</Fila>
        <Fila etiqueta="Hasta">{hora(reunion.fin)}</Fila>
      </dl>
      <div>
        {terminada ? (
          <p className="text-sm text-subtle-foreground">Ya terminó</p>
        ) : puedeUnirse ? (
          <BotonUnirse idReunion={reunion.idReunion} tamano="l" />
        ) : null}
      </div>
    </div>
  );
}

/** Aviso `reunion_finalizada`: duración, quiénes entraron, quién la finalizó y Ver detalle. */
export function DetalleReunionFinalizada({
  reunion,
  grupo,
  idUsuario,
  puedeUnirse = false,
}: {
  reunion: ReunionVideoDetalle;
  grupo: ReactNode;
  idUsuario: number;
  puedeUnirse?: boolean;
}) {
  const entradas = reunion.asistentes
    .filter((a) => a.fechaEntrada)
    .sort((a, b) => (a.fechaEntrada as Date).getTime() - (b.fechaEntrada as Date).getTime());
  const desde = reunion.iniciadaEn ?? entradas[0]?.fechaEntrada ?? reunion.inicio;
  const hasta = reunion.finalizadaEn ?? reunion.fin;
  const nombres = entradas.map((a) => (a.usuario.idUsuario === idUsuario ? "tú" : nombrePila(a.usuario.nombre)));
  const listaNombres = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}` : (nombres[0] ?? "");
  return (
    <div className="flex max-w-[620px] flex-col gap-[18px]">
      <Encabezado chip={<EstadoReunion estado="terminada" className="text-[13px]" />} titulo="Reunión terminada" reunion={reunion.titulo} grupo={grupo} />
      <dl>
        <Fila etiqueta="Duración">{duracionEntre(desde, hasta)}</Fila>
        {entradas.length > 0 ? (
          <Fila etiqueta="Entraron">
            <AvataresApilados personas={entradas.map((a) => a.usuario)} tamano={22} />
            <span className="truncate text-muted-foreground">{listaNombres.charAt(0).toUpperCase() + listaNombres.slice(1)}</span>
          </Fila>
        ) : null}
        <Fila etiqueta="Finalizada por">
          {reunion.finalizador ? <PersonaFila persona={reunion.finalizador} idUsuario={idUsuario} /> : <span>Cerrada automáticamente</span>}
        </Fila>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {reunion.reabrible && puedeUnirse ? <BotonUnirse idReunion={reunion.idReunion} tamano="l" /> : null}
        <Button variant="outline" asChild className="h-10 px-3.5 text-sm">
          <Link href={`/reuniones/${reunion.idReunion}`}>Ver detalle</Link>
        </Button>
      </div>
    </div>
  );
}
