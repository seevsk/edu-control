/**
 * Bandeja: cada notificacion se muestra con un titulo corto (que paso) y su objeto (sobre que), y
 * el detalle completo (motivo, persona, fechas) va al panel derecho. Se deriva de `tipo` y del
 * `mensaje` ya guardado, sin columnas nuevas. Funciones puras.
 */
export type TipoBandeja =
  | "invitacion_grupo"
  | "invitacion_respondida"
  | "tarea_asignada"
  | "tarea_en_revision"
  | "tarea_devuelta"
  | "tarea_completada"
  | "tarea_reabierta"
  | "tarea_reprogramada"
  | "tarea_descartada"
  | "reunion_programada"
  | "reunion_iniciada"
  | "reunion_finalizada"
  | "integrante_salio"
  | "evaluacion_creada";

const TITULOS: Record<TipoBandeja, string> = {
  invitacion_grupo: "Invitación a un grupo",
  invitacion_respondida: "Respondieron tu invitación",
  tarea_asignada: "Tarea asignada",
  tarea_en_revision: "Lista para revisar",
  tarea_devuelta: "Tarea devuelta",
  tarea_completada: "Tarea completada",
  tarea_reabierta: "Tarea reabierta",
  tarea_reprogramada: "Nueva fecha límite",
  tarea_descartada: "Tarea descartada",
  reunion_programada: "Nueva reunión",
  reunion_iniciada: "Reunión iniciada",
  reunion_finalizada: "Reunión terminada",
  integrante_salio: "Un integrante salió",
  evaluacion_creada: "Evaluación registrada",
};

export interface ResumenNotificacion {
  titulo: string;
  /** Sobre que trata: titulo de la tarea, nombre del grupo, de la reunion o de la evaluacion. */
  objeto: string | null;
  motivo: string | null;
  /** Quien hizo la accion, cuando el mensaje lo nombra. */
  persona: string | null;
}

const ENTRE_COMILLAS = /[“"]([^”"]+)[”"]/;

function sinPunto(texto: string) {
  return texto.trim().replace(/\.$/, "");
}

export function resumirNotificacion(tipo: string, mensaje: string): ResumenNotificacion {
  const base: ResumenNotificacion = { titulo: TITULOS[tipo as TipoBandeja] ?? sinPunto(mensaje), objeto: null, motivo: null, persona: null };
  const indiceMotivo = mensaje.indexOf("Motivo: ");
  const motivo = indiceMotivo === -1 ? null : sinPunto(mensaje.slice(indiceMotivo + "Motivo: ".length));
  const cita = mensaje.match(ENTRE_COMILLAS)?.[1] ?? null;

  switch (tipo) {
    case "invitacion_grupo": {
      // "Ana Torres te invitó a Grupo 7" o (registros antiguos) "Te invitaron a Grupo 7".
      const nuevo = mensaje.match(/^(.+?) te invitó a (.+)$/);
      if (nuevo) return { ...base, persona: nuevo[1], objeto: sinPunto(nuevo[2]) };
      const antiguo = mensaje.match(/^Te invitaron a (.+)$/);
      return { ...base, objeto: antiguo ? sinPunto(antiguo[1]) : null };
    }
    case "invitacion_respondida": {
      const nuevo = mensaje.match(/^(.+?) (aceptó|rechazó) tu invitación a (.+)$/);
      if (nuevo) return { ...base, titulo: nuevo[2] === "aceptó" ? "Aceptaron tu invitación" : "Rechazaron tu invitación", persona: nuevo[1], objeto: sinPunto(nuevo[3]) };
      const antiguo = mensaje.match(/^Respondieron tu invitación a (.+): (aceptada|rechazada)$/);
      if (antiguo) return { ...base, titulo: antiguo[2] === "aceptada" ? "Aceptaron tu invitación" : "Rechazaron tu invitación", objeto: antiguo[1] };
      return base;
    }
    case "reunion_programada": {
      // 'Nueva reunión en "Grupo": "Título", lun 9, 7:00pm.' -> el titulo es la segunda cita.
      const citas = [...mensaje.matchAll(/[“"]([^”"]+)[”"]/g)].map((coincidencia) => coincidencia[1]);
      return { ...base, objeto: citas[1] ?? citas[0] ?? null };
    }
    case "reunion_iniciada": {
      // 'Ana inició "Título" en "Grupo", 7:00pm - 8:00pm.'
      const citas = [...mensaje.matchAll(/[“"]([^”"]+)[”"]/g)].map((coincidencia) => coincidencia[1]);
      const persona = mensaje.match(/^(.+?) inició /)?.[1] ?? null;
      return { ...base, persona, objeto: citas[0] ?? null };
    }
    case "reunion_finalizada": {
      const citas = [...mensaje.matchAll(/[“"]([^”"]+)[”"]/g)].map((coincidencia) => coincidencia[1]);
      return { ...base, objeto: citas[0] ?? null };
    }
    case "integrante_salio": {
      const salida = mensaje.match(/^(.+?) salió de (.+?)( y te dejó como líder)?$/);
      if (!salida) return base;
      return { ...base, titulo: salida[3] ? "Ahora eres líder" : base.titulo, persona: salida[1], objeto: salida[1] };
    }
    case "evaluacion_creada": {
      const evaluacion = mensaje.match(/^Registraste (.+?) de (.+?)\. Cierra/);
      return { ...base, objeto: evaluacion ? evaluacion[1] : null };
    }
    default:
      return { ...base, objeto: cita, motivo };
  }
}
