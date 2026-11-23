import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";
import { escaparHtml, urlAbsoluta } from "../src/server/email/layout";
import { construirCorreo, type DatosParaCorreo } from "../src/server/notifications/correo";
import { EVENTOS_NOTIFICACION, type TipoNotificacionConfigurado } from "../src/server/notifications/eventos";
import { plantillasNotificacion as p } from "../src/server/notifications/templates";

/**
 * Renderiza todos los correos con datos de ejemplo en .correos-preview/ (ignorada por git) y
 * verifica con node:assert lo mínimo: escape de HTML, contenido no vacío y enlaces absolutos.
 * No usa la base de datos ni envía nada. El logo se ve si la app corre en APP_URL.
 */

config({ quiet: true });
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const SALIDA = resolve(".correos-preview");

const ahora = new Date();
const enDias = (dias: number, horas = 23, minutos = 59) => {
  const fecha = new Date(ahora.getTime() + dias * 86_400_000);
  // Hora en Lima (UTC-5, sin horario de verano).
  fecha.setUTCHours(horas + 5, minutos, 0, 0);
  return fecha;
};
const reunionInicio = enDias(3, 19, 0);
const reunionFin = enDias(3, 20, 30);

interface Ejemplo {
  id: string;
  descripcion: string;
  datos: DatosParaCorreo;
}

function ejemplo(id: string, descripcion: string, tipo: TipoNotificacionConfigurado, plantilla: Omit<DatosParaCorreo, "tipo">): Ejemplo {
  return { id, descripcion, datos: { tipo, ...plantilla } };
}

const tarea = { actor: "Ana Torres", grupo: "Proyecto Tecnológico · Grupo 3", fechaLimite: enDias(5), peso: 2 };

const ejemplos: Ejemplo[] = [
  ejemplo("invitacion-grupo", "Invitan a un grupo", "invitacion_grupo", p.invitacionGrupo("Proyecto Tecnológico · Grupo 3", 12, "Ana Torres", { rol: "miembro" })),
  ejemplo("invitacion-respondida", "Responden una invitación", "invitacion_respondida", p.invitacionRespondida("Proyecto Tecnológico · Grupo 3", 12, "aceptada", "Luis Ramos")),
  ejemplo("tarea-asignada", "Asignan una tarea", "tarea_asignada", p.tareaAsignada("Diseñar base de datos", 12, 45, tarea)),
  ejemplo("tarea-en-revision", "Una tarea pasa a revisión", "tarea_en_revision", { ...p.tareaEnRevision("Diseñar base de datos", 12, 45, { ...tarea, actor: "Luis Ramos" }), idGrupo: 12 }),
  ejemplo(
    "tarea-devuelta",
    "Devuelven una tarea",
    "tarea_devuelta",
    p.tareaDevuelta("Diseñar base de datos", 12, 45, "Falta la tabla de evaluaciones y el diagrama no coincide con el script SQL.", tarea),
  ),
  ejemplo("tarea-completada", "Una tarea queda completada", "tarea_completada", { ...p.tareaCompletada("Diseñar base de datos", 12, 45, tarea), idGrupo: 12 }),
  ejemplo("tarea-autoaprobada", "El líder aprueba su propia entrega", "tarea_completada", { ...p.tareaAutoaprobada("Redactar introducción", 12, 46, tarea), idGrupo: 12 }),
  ejemplo("tarea-reabierta", "El líder reabre una tarea", "tarea_reabierta", p.tareaReabierta("Diseñar base de datos", 12, 45, "El profesor pidió agregar índices.", tarea)),
  ejemplo("tarea-reprogramada", "Cambia la fecha límite", "tarea_reprogramada", p.tareaReprogramada("Diseñar base de datos", 12, 45, "Vie 27 nov", { ...tarea, fechaLimite: enDias(7) })),
  ejemplo("tarea-descartada", "El líder descarta una tarea", "tarea_descartada", p.tareaDescartada("Maqueta en Figma", 12, 47, "Usaremos los diseños del curso.", tarea)),
  ejemplo(
    "reunion-programada",
    "Programan una reunión",
    "reunion_programada",
    p.reunionProgramada("Revisión de avance", "Proyecto Tecnológico · Grupo 3", 12, 8, "jueves 26 de noviembre, 7:00pm", {
      organizador: "Ana Torres",
      inicio: reunionInicio,
      fin: reunionFin,
      videollamada: true,
    }),
  ),
  ejemplo("reunion-iniciada", "Inicia una videollamada", "reunion_iniciada", p.reunionIniciada("Ana Torres", "Revisión de avance", "Proyecto Tecnológico · Grupo 3", 8, "7:00pm", "8:30pm")),
  ejemplo("reunion-finalizada", "Termina una videollamada", "reunion_finalizada", {
    ...p.reunionFinalizada("Revisión de avance", "Proyecto Tecnológico · Grupo 3", 8, "1 h 12 min", 4, "Ana Torres"),
    idGrupo: 12,
  }),
  ejemplo("reunion-finalizada-auto", "Termina una videollamada (cierre automático)", "reunion_finalizada", {
    ...p.reunionFinalizada("Revisión de avance", "Proyecto Tecnológico · Grupo 3", 8, "45 min", 1, null),
    idGrupo: 12,
  }),
  ejemplo("integrante-salio", "Un integrante sale del grupo", "integrante_salio", p.integranteSalio("Luis Ramos", "Proyecto Tecnológico · Grupo 3", 12, true)),
  ejemplo(
    "evaluacion-creada",
    "Registras una evaluación",
    "evaluacion_creada",
    p.evaluacionCreada("Examen parcial", "Base de Datos II", 3, 21, "el viernes", { fechaApertura: enDias(9, 8, 0), fechaCierre: enDias(9), requiereEntrega: true }),
  ),
  ejemplo("sin-plantilla", "Aviso sin contenido de correo (respaldo)", "tarea_asignada", { mensaje: "Te asignaron “Algo”", enlace: "/grupos/12/tareas/45", asunto: "Te asignaron “Algo”" }),
];

function verificar() {
  // Todos los tipos configurados tienen al menos un ejemplo.
  const cubiertos = new Set(ejemplos.map((e) => e.datos.tipo));
  for (const tipo of Object.keys(EVENTOS_NOTIFICACION)) assert.ok(cubiertos.has(tipo as TipoNotificacionConfigurado), `Falta un ejemplo de ${tipo}`);

  for (const { id, datos } of ejemplos) {
    const correo = construirCorreo(datos, APP_URL);
    assert.ok(correo.asunto.trim(), `${id}: asunto vacío`);
    assert.ok(correo.html.trim(), `${id}: html vacío`);
    assert.ok(correo.texto.trim(), `${id}: texto vacío`);
    const destino = urlAbsoluta(datos.enlace, APP_URL);
    assert.ok(destino.startsWith(new URL(APP_URL).origin), `${id}: el enlace no es absoluto con APP_URL`);
    assert.ok(correo.html.includes(`href="${escaparHtml(destino)}"`), `${id}: el botón no enlaza a ${destino}`);
    assert.ok(correo.texto.includes(destino), `${id}: el texto no incluye ${destino}`);
    assert.ok(correo.html.includes(`${new URL(APP_URL).origin}/correo-logo.png`), `${id}: falta el logo absoluto`);
    assert.ok(!/<svg|<script/i.test(correo.html), `${id}: el HTML no debe llevar SVG ni scripts`);
    // Los correos de actividad explican cómo silenciarlos y enlazan a Integrantes del grupo.
    if (EVENTOS_NOTIFICACION[datos.tipo].actividad && datos.idGrupo && datos.correo) {
      assert.ok(correo.html.includes(`/grupos/${datos.idGrupo}/integrantes`), `${id}: falta el enlace para silenciar`);
    }
  }

  // Escape: el texto de usuarios nunca se interpreta como HTML.
  const malicioso = `<script>alert("x")</script> & <img src=x onerror=alert(1)>`;
  const inyectado = construirCorreo(
    { tipo: "tarea_devuelta", ...p.tareaDevuelta(malicioso, 1, 2, `"><b>motivo</b>`, { actor: "<i>Eva</i>", grupo: "G & 'H'" }) },
    APP_URL,
  );
  assert.ok(!inyectado.html.includes("<script>"), "Se coló un <script> en el HTML");
  assert.ok(!inyectado.html.includes("<img src=x"), "Se coló un <img> en el HTML");
  assert.ok(!inyectado.html.includes("<b>motivo</b>"), "Se coló HTML del motivo");
  assert.ok(!inyectado.html.includes("<i>Eva</i>"), "Se coló HTML del nombre");
  assert.ok(inyectado.html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp;"), "El título no quedó escapado");
  assert.ok(inyectado.html.includes("G &amp; &#39;H&#39;"), "El grupo no quedó escapado");
  // El texto plano conserva el texto tal cual (no es HTML).
  assert.ok(inyectado.texto.includes(malicioso));

  // Un enlace hacia otro origen nunca sale del dominio de la app.
  assert.equal(urlAbsoluta("https://otro.example/x", APP_URL), new URL("/", APP_URL).toString());
  assert.equal(urlAbsoluta("//otro.example/x", APP_URL), new URL("/", APP_URL).toString());
  assert.equal(urlAbsoluta("/grupos/1", APP_URL), new URL("/grupos/1", APP_URL).toString());
}

function indice(filas: { id: string; descripcion: string; tipo: string; asunto: string; envia: boolean }[]) {
  const e = escaparHtml;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Correos de EduControl · vista previa</title>
<style>
body{margin:0;padding:32px 16px;background:#f7f7f8;color:#18181b;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
main{max-width:880px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 20px;color:#52525b}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e9e9eb;border-radius:8px;overflow:hidden}
th,td{text-align:left;padding:10px 12px;border-top:1px solid #e9e9eb;vertical-align:top}th{border-top:0;font-size:12px;color:#52525b;font-weight:600}
code{font:12px ui-monospace,Menlo,Consolas,monospace;color:#52525b}a{color:#18181b}.no{color:#a1a1aa}
</style></head><body><main>
<h1>Correos de EduControl</h1>
<p>${filas.length} ejemplos · APP_URL ${e(APP_URL)} · generado ${e(new Date().toLocaleString("es-PE", { timeZone: "America/Lima" }))}</p>
<table><thead><tr><th>Evento</th><th>Asunto</th><th>¿Se envía?</th><th>Archivos</th></tr></thead><tbody>
${filas
  .map(
    (f) =>
      `<tr><td>${e(f.descripcion)}<br><code>${e(f.tipo)}</code></td><td>${e(f.asunto)}</td><td class="${f.envia ? "" : "no"}">${f.envia ? "Sí" : "No, solo en la app"}</td><td><a href="${e(f.id)}.html">HTML</a> · <a href="${e(f.id)}.txt">Texto</a></td></tr>`,
  )
  .join("\n")}
</tbody></table></main></body></html>`;
}

async function main() {
  verificar();
  await rm(SALIDA, { recursive: true, force: true });
  await mkdir(SALIDA, { recursive: true });
  const filas = [];
  for (const { id, descripcion, datos } of ejemplos) {
    const correo = construirCorreo(datos, APP_URL);
    await writeFile(resolve(SALIDA, `${id}.html`), correo.html, "utf8");
    await writeFile(resolve(SALIDA, `${id}.txt`), `Asunto: ${correo.asunto}\n\n${correo.texto}\n`, "utf8");
    filas.push({ id, descripcion, tipo: datos.tipo, asunto: correo.asunto, envia: EVENTOS_NOTIFICACION[datos.tipo].correo });
  }
  const rutaIndice = resolve(SALIDA, "index.html");
  await writeFile(rutaIndice, indice(filas), "utf8");
  console.log(`Verificación de correos: OK (${ejemplos.length} ejemplos).`);
  console.log(`Vista previa: ${pathToFileURL(rutaIndice).toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
