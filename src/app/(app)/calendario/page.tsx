import type { Metadata } from "next";
import { requerirSesion } from "@/server/auth/session";
import { obtenerCalendarioEntre } from "@/server/services/calendario";
import { diasDeVistaMes, fechaEnZonaLimaISO, lunesDeSemanaISO, sumarDiasISO } from "@/lib/calendario";
import { Toast } from "@/components/toast";
import { DialogoUrl } from "@/components/ui-app/dialogo-url";
import { PaginaCompleta } from "@/components/ui-app/page-header";
import { Migas } from "@/components/ui-app/barra-superior";
import { FormularioBloque } from "./_components/formulario-bloque";
import { CalendarioVista } from "./_components/calendario-vista";
import { construirEventos, minutosPorFiltro } from "./_components/eventos";
import type { ModoCalendario } from "./_components/tipos-calendario";
import { crearBloqueOcupadoAction } from "./actions";

export const metadata: Metadata = { title: "Calendario" };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function esModo(valor: string | undefined): valor is ModoCalendario {
  return valor === "mes" || valor === "semana" || valor === "agenda";
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; fecha?: string; semana?: string; mes?: string; error?: string; toast?: string; nuevoBloque?: string }>;
}) {
  const sesion = await requerirSesion();
  const { modo: modoParam, fecha: fechaParam, semana, mes, error, toast, nuevoBloque } = await searchParams;
  const hoyISO = fechaEnZonaLimaISO(new Date());
  // Los enlaces anteriores usaban `semana=` y `mes=`; se siguen aceptando.
  const fecha = fechaParam && FECHA.test(fechaParam)
    ? fechaParam
    : semana && FECHA.test(semana)
      ? semana
      : mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
        ? `${mes}-01`
        : hoyISO;
  const modo: ModoCalendario = esModo(modoParam) ? modoParam : mes && !semana ? "mes" : "semana";

  // Rango amplio que cubre la vista de mes (con días vecinos), la semana y la agenda de 14 días.
  const lunes = lunesDeSemanaISO(new Date(`${fecha}T12:00:00-05:00`));
  const inicioMes = diasDeVistaMes(fecha.slice(0, 7))[0];
  const desdeISO = sumarDiasISO(inicioMes < lunes ? inicioMes : lunes, -7);
  const finAgenda = sumarDiasISO(fecha, 21);
  const hastaISO = sumarDiasISO(desdeISO, 56) > finAgenda ? sumarDiasISO(desdeISO, 56) : finAgenda;

  const datos = await obtenerCalendarioEntre(sesion.idUsuario, desdeISO, hastaISO);
  const rutaActual = `/calendario?modo=${modo}&fecha=${fecha}`;
  const eventos = construirEventos(datos, `?modo=${modo}&fecha=${fecha}`);

  return (
    <PaginaCompleta>
      <Migas items={[{ texto: "Calendario" }]} />
      <Toast mensaje={toast} />
      <div className="px-4 py-5 sm:px-6">
        {error && nuevoBloque !== "1" ? (
          <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>
        ) : null}
        <CalendarioVista eventos={eventos} minutos={minutosPorFiltro(eventos)} modo={modo} fecha={fecha} hoyISO={hoyISO} />
      </div>

      {nuevoBloque === "1" ? (
        <DialogoUrl titulo="Agregar tiempo ocupado" descripcion="Se repite cada semana y tu grupo lo ve como ocupado, sin el detalle." cerrarEn={rutaActual}>
          {error ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>
          ) : null}
          <FormularioBloque
            action={crearBloqueOcupadoAction}
            modo="crear"
            valores={{ tipo: "laboral", dias: [], horaInicio: "09:00", horaFin: "13:00", detalle: "" }}
            volverA={rutaActual}
            origen={`${rutaActual}&nuevoBloque=1`}
          />
        </DialogoUrl>
      ) : null}
    </PaginaCompleta>
  );
}
