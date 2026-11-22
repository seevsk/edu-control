import assert from "node:assert/strict";
import {
  type DatosCierreReunion,
  accionSalaVacia,
  comoVigente,
  debeFinalizarPorSalaVacia,
  estadoReunion,
  intervaloOcupado,
  puedeReabrirse,
  rangoReunirseAhora,
  ventanaSala,
} from "../src/lib/estado-reunion";

// Reglas puras de reuniones: no requiere base de datos.
const MIN = 60_000;
const t = (iso: string) => new Date(iso);
const mas = (fecha: Date, minutos: number) => new Date(fecha.getTime() + minutos * MIN);

const inicio = t("2026-11-22T20:00:00-05:00");
const fin = t("2026-11-22T21:00:00-05:00");
const { apertura, cierre } = ventanaSala(inicio, fin);
assert.equal(apertura.getTime(), mas(inicio, -10).getTime());
assert.equal(cierre.getTime(), mas(fin, 15).getTime());

const base: DatosCierreReunion = { inicio, fin, videollamada: true, iniciadaEn: null, finalizadaEn: null, idFinalizador: null };

// Estados de la ventana.
assert.equal(estadoReunion(base, mas(inicio, -11)), "programada");
assert.equal(estadoReunion(base, mas(inicio, -10)), "sala_abierta");
assert.equal(estadoReunion({ ...base, iniciadaEn: inicio }, mas(inicio, 5)), "en_curso");
assert.equal(estadoReunion({ ...base, iniciadaEn: inicio }, mas(fin, 11)), "por_cerrar");
assert.equal(estadoReunion(base, cierre), "terminada");
assert.equal(estadoReunion({ ...base, finalizadaEn: mas(inicio, 5) }, mas(inicio, 6)), "terminada");
const manual = { ...base, videollamada: false };
assert.equal(estadoReunion(manual, mas(fin, -1)), "programada");
assert.equal(estadoReunion(manual, fin), "terminada");

// Sala vacia: antes de la hora de inicio no finaliza, solo limpia iniciadaEn.
const entroTemprano = { ...base, iniciadaEn: mas(inicio, -8) };
assert.equal(accionSalaVacia(entroTemprano, mas(inicio, -6)), "limpiar_inicio");
assert.equal(debeFinalizarPorSalaVacia(entroTemprano, mas(inicio, -6)), false);
assert.equal(accionSalaVacia(entroTemprano, inicio), "finalizar");
assert.equal(debeFinalizarPorSalaVacia(entroTemprano, mas(inicio, 10)), true);
assert.equal(accionSalaVacia(base, mas(inicio, 10)), "ninguna", "sin iniciar no hay nada que cerrar");
assert.equal(accionSalaVacia({ ...entroTemprano, finalizadaEn: mas(inicio, 3) }, mas(inicio, 10)), "ninguna");
assert.equal(accionSalaVacia({ ...entroTemprano, videollamada: false }, mas(inicio, 10)), "ninguna");
assert.equal(accionSalaVacia({ ...entroTemprano, iniciadaEn: inicio }, cierre), "ninguna", "vencida: la cierra el horario");

// Reabrible vs no reabrible.
const cerradaSola = { ...base, iniciadaEn: inicio, finalizadaEn: mas(inicio, 20), idFinalizador: null };
assert.equal(puedeReabrirse(cerradaSola, mas(inicio, 25)), true);
assert.equal(puedeReabrirse(cerradaSola, mas(cierre, -1)), true);
assert.equal(puedeReabrirse(cerradaSola, cierre), false, "fuera de la ventana");
assert.equal(puedeReabrirse({ ...cerradaSola, idFinalizador: 7 }, mas(inicio, 25)), false, "la finalizo un moderador");
assert.equal(puedeReabrirse({ ...cerradaSola, finalizadaEn: cierre }, mas(cierre, -1)), false, "cierre por horario");
assert.equal(puedeReabrirse({ ...cerradaSola, finalizadaEn: mas(cierre, 1) }, mas(cierre, -1)), false);
assert.equal(puedeReabrirse({ ...cerradaSola, finalizadaEn: null }, mas(inicio, 25)), false, "no esta cerrada");
assert.equal(puedeReabrirse({ ...cerradaSola, videollamada: false }, mas(inicio, 25)), false);

// comoVigente: reabrible se ve como no finalizada; el resto no cambia.
const vigente = comoVigente(cerradaSola, mas(inicio, 25));
assert.equal(vigente.finalizadaEn, null);
assert.equal(estadoReunion(vigente, mas(inicio, 25)), "en_curso");
assert.equal(estadoReunion(cerradaSola, mas(inicio, 25)), "terminada");
assert.equal(comoVigente(cerradaSola, mas(inicio, 25), false), cerradaSola, "grupo finalizado: solo lectura");
const porModerador = { ...cerradaSola, idFinalizador: 3 };
assert.equal(comoVigente(porModerador, mas(inicio, 25)), porModerador);
assert.equal(estadoReunion(comoVigente(cerradaSola, cierre), cierre), "terminada");

// Tiempo ocupado: hasta finalizadaEn si cerro antes del fin; nada si cerro antes de iniciar.
assert.deepEqual(intervaloOcupado(base), { inicio, fin });
assert.deepEqual(intervaloOcupado({ ...base, finalizadaEn: mas(inicio, 20) }), { inicio, fin: mas(inicio, 20) });
assert.deepEqual(intervaloOcupado({ ...base, finalizadaEn: mas(fin, 5) }), { inicio, fin });
assert.equal(intervaloOcupado({ ...base, finalizadaEn: mas(inicio, -3) }), null);
assert.equal(intervaloOcupado({ ...base, finalizadaEn: inicio }), null);

// Reunirse ahora: 1 h, sin cruzar la medianoche de Lima.
const normal = rangoReunirseAhora(t("2026-11-22T15:30:40-05:00"));
assert.equal(normal.inicio.getTime(), t("2026-11-22T15:30:00-05:00").getTime());
assert.equal(normal.fin.getTime(), t("2026-11-22T16:30:00-05:00").getTime());
const tarde = rangoReunirseAhora(t("2026-11-22T23:30:10-05:00"));
assert.equal(tarde.inicio.getTime(), t("2026-11-22T23:30:00-05:00").getTime());
assert.equal(tarde.fin.getTime(), t("2026-11-22T23:59:00-05:00").getTime());
const casiMedianoche = rangoReunirseAhora(t("2026-11-22T23:59:30-05:00"));
assert.equal(casiMedianoche.inicio.getTime(), t("2026-11-22T23:58:00-05:00").getTime());
assert.equal(casiMedianoche.fin.getTime(), t("2026-11-22T23:59:00-05:00").getTime());
assert.ok(casiMedianoche.fin > casiMedianoche.inicio);

console.log("Verificacion de reuniones: OK");
