"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OPCIONES_HORA, diaSemanaISO } from "@/lib/calendario";
import type { Intervalo } from "@/lib/disponibilidad";
import { SubmitButton } from "@/components/submit-button";
import { crearReunionAction } from "../actions";

export type Sugerencia = { fecha: string; inicio: string; fin: string; etiqueta: string; faltan: string | null };

const CAMPO = "rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-normal";

function aMinutos(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Sugiere los huecos en comun, pero no obliga a usarlos: si la hora elegida pisa el horario de
 * alguien solo se avisa (el grupo puede decidir reunirse igual).
 */
export function FormularioReunion({
  grupos,
  idGrupo,
  hoyISO,
  integrantes,
  sugerencias,
  iniciales,
}: {
  grupos: { idGrupo: number; nombre: string }[];
  idGrupo: number | null;
  hoyISO: string;
  integrantes: { idUsuario: number; nombre: string; ocupados: Intervalo[] }[];
  sugerencias: Sugerencia[];
  iniciales: { fecha: string; inicio: string; fin: string };
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState(iniciales.fecha);
  const [inicio, setInicio] = useState(iniciales.inicio);
  const [fin, setFin] = useState(iniciales.fin);

  const finAntesDeInicio = aMinutos(fin) <= aMinutos(inicio);
  let chocan: string[] | null = null;
  if (idGrupo && fecha && !finAntesDeInicio) {
    const base = (diaSemanaISO(fecha) - 1) * 24 * 60;
    const desde = base + aMinutos(inicio);
    const hasta = base + aMinutos(fin);
    chocan = integrantes
      .filter((i) => i.ocupados.some(([a, b]) => a < hasta && b > desde))
      .map((i) => i.nombre);
  }

  return (
    <form action={crearReunionAction} className="flex flex-col gap-5 rounded-md border border-border bg-surface p-4 sm:p-6">
      <label className="flex max-w-sm flex-col gap-1 text-sm font-medium">
        Grupo
        <select
          name="idGrupo"
          required
          value={idGrupo ?? ""}
          onChange={(e) => router.push(`/reuniones/nueva?grupo=${e.target.value}`)}
          className={CAMPO}
        >
          {idGrupo === null ? <option value="">Elige un grupo</option> : null}
          {grupos.map((grupo) => (
            <option key={grupo.idGrupo} value={grupo.idGrupo}>
              {grupo.nombre}
            </option>
          ))}
        </select>
      </label>

      {idGrupo ? (
        <>
          {sugerencias.length > 0 ? (
            <fieldset>
              <legend className="text-sm font-medium">Sugerencias</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {sugerencias.map((s) => {
                  const elegida = s.fecha === fecha && s.inicio === inicio && s.fin === fin;
                  return (
                    <button
                      key={`${s.fecha}-${s.inicio}`}
                      type="button"
                      aria-pressed={elegida}
                      onClick={() => {
                        setFecha(s.fecha);
                        setInicio(s.inicio);
                        setFin(s.fin);
                      }}
                      className={`rounded-md border px-3 py-1.5 text-left text-sm tabular-nums transition-colors duration-150 ${
                        elegida
                          ? "border-estado-completada bg-estado-completada/15 font-medium"
                          : "border-border-strong bg-surface hover:border-estado-completada/60"
                      }`}
                    >
                      {s.etiqueta}
                      {s.faltan ? <span className="block text-xs font-normal text-text-muted">falta {s.faltan}</span> : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <label className="flex flex-col gap-1 text-sm font-medium">
            Título
            <input name="titulo" required maxLength={120} placeholder="Ej. Avance del informe" className={`${CAMPO} placeholder:text-text-muted`} />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Fecha
              <input
                type="date"
                name="fecha"
                required
                min={hoyISO}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={CAMPO}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Desde
              <select name="horaInicio" value={inicio} onChange={(e) => setInicio(e.target.value)} required className={`${CAMPO} tabular-nums`}>
                {OPCIONES_HORA.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Hasta
              <select name="horaFin" value={fin} onChange={(e) => setFin(e.target.value)} required className={`${CAMPO} tabular-nums`}>
                {OPCIONES_HORA.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {finAntesDeInicio ? (
            <p role="alert" className="text-sm text-danger">
              La hora de fin debe ser después de la de inicio.
            </p>
          ) : chocan === null ? null : chocan.length === 0 ? (
            <p aria-live="polite" className="flex items-center gap-2 text-sm text-estado-completada">
              <span className="size-2 rounded-full bg-estado-completada" aria-hidden />
              Todos libres
            </p>
          ) : (
            <p aria-live="polite" className="flex items-center gap-2 rounded-md bg-cat-laboral-bg px-3 py-2 text-sm text-cat-laboral-fg">
              <span className="size-2 shrink-0 rounded-full bg-cat-laboral" aria-hidden />
              Choca con el horario de {chocan.join(", ")}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>
                Lugar <span className="font-normal text-text-muted">(opcional)</span>
              </span>
              <input name="lugar" maxLength={160} placeholder="Ej. Biblioteca, sala 3" className={`${CAMPO} placeholder:text-text-muted`} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>
                Enlace <span className="font-normal text-text-muted">(opcional)</span>
              </span>
              <input name="enlace" type="url" placeholder="https://meet.google.com/..." className={`${CAMPO} placeholder:text-text-muted`} />
            </label>
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-5">
            <SubmitButton className="justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
              Programar reunión
            </SubmitButton>
          </div>
        </>
      ) : null}
    </form>
  );
}
