"use client";

import { useId, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";

export function ConfirmarAceptacion({
  nombreGrupo,
  action,
}: {
  nombreGrupo: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const detalleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
      >
        Aceptar
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={tituloId}
        aria-describedby={detalleId}
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) evento.currentTarget.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-md border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-slate-950/50"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 id={tituloId} className="text-base font-semibold">
            Antes de unirte a {nombreGrupo}
          </h2>
          <p id={detalleId} className="mt-1 text-sm text-text-muted">
            Tu horario y disponibilidad pueden revelar rutinas personales. Revisa qué información podrán ver otros
            integrantes y para qué se usará.
          </p>
        </div>

        <form action={action} className="flex flex-col gap-4 px-5 py-4">
          <div className="rounded-md border border-primary/30 bg-primary-soft p-3 text-sm">
            <p className="font-medium">Al aceptar, autorizas su uso para coordinar el trabajo y las reuniones del grupo.</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-text-muted">
              <li>
                Los integrantes aceptados podrán ver tus datos básicos de perfil, como nombres, institución, carrera,
                ciclo, biografía y si trabajas.
              </li>
              <li>
                Los integrantes aceptados que no sean observadores podrán consultar tu disponibilidad semanal, los
                nombres de tus clases y la categoría de tus bloques ocupados.
              </li>
              <li>
                En el mapa del grupo se mostrará cuándo estás libre u ocupado para encontrar horarios en común.
              </li>
            </ul>
          </div>

          <p className="text-sm text-text-muted">
            No se mostrará el detalle que escribas en tus bloques, tu correo ni tus evaluaciones. Si rechazas la
            invitación, no se habilitará el acceso del grupo a tu disponibilidad.
          </p>

          <label className="flex items-start gap-2.5 rounded-md border border-border-strong p-3 text-sm">
            <input
              type="checkbox"
              name="consentimientoPrivacidad"
              value="acepto"
              required
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              He leído esta información y autorizo el uso y la visualización de estos datos personales para la
              coordinación del grupo.
            </span>
          </label>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium hover:bg-bg"
            >
              Volver
            </button>
            <SubmitButton
              pendingText="Uniéndome..."
              className="justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Aceptar y compartir
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
