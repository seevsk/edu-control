import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { config } from "dotenv";
import { Client } from "pg";
import { SignJWT } from "jose";
import { createRequire } from "node:module";

// encodeReply es lo que usa el navegador para enviar argumentos a una Server Action (viene con Next).
process.env.NODE_ENV ??= "production";
const { encodeReply } = createRequire(import.meta.url)("next/dist/compiled/react-server-dom-webpack/client.node");

config({ quiet: true });

async function puertoLibre() {
  const servidor = createServer();
  await new Promise((resolve, reject) => {
    servidor.once("error", reject);
    servidor.listen(0, "127.0.0.1", resolve);
  });
  const puerto = servidor.address().port;
  await new Promise((resolve) => servidor.close(resolve));
  return puerto;
}

async function verificar() {
  if (process.argv.includes("--visual")) {
    assert.ok(process.stdin.isTTY, "La revisión visual necesita una terminal interactiva; ejecuta sin --visual para las pruebas HTTP");
  }
  assert.ok(fs.existsSync(".next/BUILD_ID"), "Ejecuta npm run build antes de la prueba HTTP");
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Solo PostgreSQL local");
  const nombre = `educontrol_verificacion_${randomUUID().replaceAll("-", "")}`;
  assert.match(nombre, /^educontrol_verificacion_[a-f0-9]{32}$/);
  url.pathname = "/postgres";
  url.search = "";
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  let creada = false;
  let db, servidor, log, proxy;
  try {
    await admin.query(`CREATE DATABASE "${nombre}"`);
    creada = true;
    url.pathname = `/${nombre}`;
    db = new Client({ connectionString: url.toString() });
    await db.connect();
    const migraciones = fs.readdirSync("prisma/migrations", { withFileTypes: true })
      .filter((entrada) => entrada.isDirectory()).map((entrada) => entrada.name).sort();
    for (const migracion of migraciones) {
      await db.query(fs.readFileSync(`prisma/migrations/${migracion}/migration.sql`, "utf8"));
    }
    for (const [id, persona] of [[1, "Lider"], [2, "Ana"], [3, "Bruno"], [4, "Observador"], [5, "Invitado"], [6, "Retirado"], [7, "Externo"]]) {
      await db.query("INSERT INTO usuario (id_usuario,google_id,correo,nombre) VALUES ($1,$2,$3,$4)",
        [id, `http-${id}`, `http${id}@example.invalid`, persona]);
      await db.query("INSERT INTO perfil (id_usuario) VALUES ($1)", [id]);
    }
    await db.query("INSERT INTO grupo (id_grupo,id_creador,nombre,estado) VALUES (1,1,'Grupo HTTP','activo'),(2,1,'Grupo cerrado','finalizado')");
    for (const grupo of [1, 2]) {
      await db.query(`INSERT INTO grupo_integrante (id_grupo,id_usuario,rol,estado_invitacion) VALUES
        ($1,1,'lider','aceptada'),($1,2,'miembro','aceptada'),($1,3,'miembro','aceptada'),
        ($1,4,'observador','aceptada'),($1,5,'miembro','pendiente'),($1,6,'miembro','retirado')`, [grupo]);
    }
    await db.query(`INSERT INTO tarea (id_tarea,id_grupo,id_creador,id_asignado,titulo,peso,estado,fecha_terminada) VALUES
      (1,1,1,2,'Pendiente HTTP',1,'pendiente',NULL),
      (2,1,1,2,'Progreso HTTP',2,'en_progreso',NULL),
      (3,1,1,2,'Revision HTTP',3,'en_revision','2026-10-09T15:00:00Z'),
      (4,1,1,2,'Completada HTTP',1,'completada','2026-10-09T15:00:00Z'),
      (5,1,1,1,'Revision del lider',1,'en_revision','2026-10-09T15:00:00Z'),
      (6,2,1,2,'Revision cerrada',1,'en_revision','2026-10-09T15:00:00Z'),
      (7,1,1,NULL,'Sin responsable HTTP',1,'pendiente',NULL),
      (8,1,1,2,'Revision a devolver',1,'en_revision','2026-10-09T15:00:00Z'),
      (9,2,1,NULL,'Sin responsable cerrada',1,'pendiente',NULL)`);
    // Las tareas en revisión llevan su entrega vigente; enviar una entrega por HTTP se prueba aparte con la tarea 2.
    await db.query(`INSERT INTO entrega (id_tarea,id_autor,titulo,enlace) VALUES
      (3,2,'Entrega 3','https://example.invalid/3'),(5,1,'Entrega 5','https://example.invalid/5'),
      (6,2,'Entrega 6','https://example.invalid/6'),(8,2,'Entrega 8','https://example.invalid/8')`);
    const puerto = await puertoLibre();
    const base = `http://127.0.0.1:${puerto}`;
    log = fs.openSync(".next/verificar-acciones-tarea-http.log", "w");
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(puerto)], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url.toString(), APP_URL: base },
      stdio: ["ignore", log, log], windowsHide: true,
    });
    for (let intento = 0; intento < 100; intento++) {
      try { if ((await fetch(`${base}/login`)).ok) break; } catch { /* El servidor aún está arrancando. */ }
      assert.equal(servidor.exitCode, null, "El servidor de prueba terminó inesperadamente");
      assert.ok(intento < 99, "El servidor de prueba no arrancó");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const cookies = new Map();
    for (const id of [1, 2, 3, 4, 5, 6, 7]) {
      const token = await new SignJWT({ idUsuario: id }).setProtectedHeader({ alg: "HS256" })
        .setIssuedAt().setExpirationTime("30m").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
      cookies.set(id, `educontrol_session=${token}`);
    }
    let casos = 0;
    async function caso(descripcion, prueba) {
      await prueba();
      casos++;
      console.log(`OK ${descripcion}`);
    }
    async function html(ruta, actor = 3) {
      const respuesta = await fetch(base + ruta, { headers: { Cookie: cookies.get(actor) }, redirect: "manual" });
      assert.equal(respuesta.status, 200, ruta);
      return respuesta.text();
    }
    /**
     * El detalle de la tarea vive en un panel lateral que React dibuja en el navegador: sus formularios
     * no están en el HTML, sino en los datos RSC (self.__next_f). La prueba lee ambos.
     */
    function datosRsc(contenido) {
      return [...contenido.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map((m) => JSON.parse(m[1])).join("");
    }
    async function pagina(ruta, actor = 3) {
      const contenido = await html(ruta, actor);
      return { html: contenido, rsc: datosRsc(contenido), todo: contenido + datosRsc(contenido) };
    }
    /** ¿La página ofrece este botón o acción? (en HTML o en los datos del panel). */
    function ofrece(pag, etiqueta) {
      return pag.html.includes(`>${etiqueta}<`) || pag.rsc.includes(`"children":"${etiqueta}"`) || pag.rsc.includes(`,"${etiqueta}"]`);
    }
    /**
     * Next deduplica objetos repetidos en los datos RSC ("$48:4" apunta a la propiedad 4 de la fila 48)
     * y marca los undefined como "$undefined". El navegador los resuelve al leer; aquí se hace igual
     * para enviar los mismos argumentos que enviaría él.
     */
    function resolverReferencias(rsc, valor) {
      if (valor === "$undefined") return undefined;
      if (typeof valor === "string") {
        const ref = valor.match(/^\$([0-9a-f]+)((?::[^:]+)*)$/);
        if (!ref) return valor;
        const fila = rsc.match(new RegExp(`(?:^|\\n)${ref[1]}:([^\\n]*)`));
        assert.ok(fila, `Fila RSC ${ref[1]} no encontrada`);
        let actual = JSON.parse(fila[1]);
        for (const clave of ref[2].split(":").filter(Boolean)) actual = actual[clave];
        return resolverReferencias(rsc, actual);
      }
      if (Array.isArray(valor)) return valor.map((hijo) => resolverReferencias(rsc, hijo));
      if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, resolverReferencias(rsc, v)]));
      return valor;
    }
    /**
     * Referencia de la Server Action del formulario que muestra `etiqueta`: su id y los argumentos
     * ligados (`bound`), tal como los recibe el navegador. Es lo que un atacante podría copiar.
     */
    function accion(pag, etiqueta) {
      const posicion = pag.rsc.indexOf(`"children":"${etiqueta}"`);
      assert.ok(posicion !== -1, `Falta la acción: ${etiqueta}`);
      const previa = pag.rsc.lastIndexOf('"action":"$h', posicion);
      const siguiente = pag.rsc.indexOf('"action":"$h', posicion);
      // Botones simples: el formulario envuelve la etiqueta. Con motivo (o "Cambiar responsable"): la etiqueta
      // es el resumen de un <details> y el formulario va después.
      const esResumen = pag.rsc.slice(Math.max(0, posicion - 400), posicion).lastIndexOf('"summary"') > pag.rsc.slice(Math.max(0, posicion - 400), posicion).lastIndexOf('"button"');
      const inicio = esResumen || previa === -1 ? siguiente : previa;
      const fila = pag.rsc.slice(inicio).match(/^"action":"\$h([0-9a-f]+)"/)[1];
      const referencia = JSON.parse(pag.rsc.match(new RegExp(`(?:^|\\n)${fila}:(\\{[^\\n]*\\})`))[1]);
      const filaLigada = referencia.bound.replace("$@", "");
      const ligados = resolverReferencias(pag.rsc, JSON.parse(pag.rsc.match(new RegExp(`(?:^|\\n)${filaLigada}:(\\[[^\\n]*\\])`))[1]));
      return { id: referencia.id, ligados };
    }
    /** Invoca la Server Action como lo hace el navegador (cabecera Next-Action + encodeReply). */
    async function invocar(ruta, actor, referencia, campos = {}, destino = ruta, conError = false) {
      const form = new FormData();
      for (const [nombre, valor] of Object.entries(campos)) form.set(nombre, valor);
      const respuesta = await fetch(base + ruta, {
        method: "POST",
        headers: { Cookie: cookies.get(actor), Origin: base, Accept: "text/x-component", "Next-Action": referencia.id },
        body: await encodeReply([...referencia.ligados, form]),
        redirect: "manual",
      });
      const redireccion = respuesta.headers.get("x-action-redirect");
      assert.ok(redireccion, `La acción no redirigió (HTTP ${respuesta.status})`);
      const retorno = new URL(redireccion.split(";")[0], base);
      const esperado = new URL(destino, base);
      assert.equal(retorno.pathname, esperado.pathname);
      assert.equal(retorno.searchParams.get("tarea"), esperado.searchParams.get("tarea"));
      assert.equal(Boolean(retorno.searchParams.get("error")), conError, retorno.searchParams.get("error") ?? "sin error");
      return retorno.pathname + retorno.search;
    }
    const lista = "/grupos/1";
    const tablero = "/grupos/1?vista=tablero";
    const detalle = (idTarea, idGrupo = 1) => `/grupos/${idGrupo}?tarea=${idTarea}`;
    const espera = "Esperando revisión";
    await caso("solo el líder revisa: aprueba y devuelve; el responsable espera; la lista avisa qué revisar", async () => {
      const lider = await pagina(detalle(3), 1);
      assert.ok(ofrece(lider, "Aprobar") && ofrece(lider, "Devolver"));
      assert.ok(!ofrece(lider, espera));
      const responsable = await pagina(detalle(3), 2);
      assert.ok(ofrece(responsable, espera));
      assert.ok(!ofrece(responsable, "Aprobar") && !ofrece(responsable, "Devolver"));
      // Un miembro que no es el responsable tampoco revisa: ya no basta con ser "otro integrante".
      const otro = await pagina(detalle(3), 3);
      assert.ok(!ofrece(otro, "Aprobar") && !ofrece(otro, "Devolver") && !ofrece(otro, espera));
      assert.ok((await pagina(lista, 1)).todo.includes("Te toca revisar"));
      for (const actor of [2, 3, 4]) assert.ok(!(await pagina(lista, actor)).todo.includes("Te toca revisar"), `actor ${actor}`);
    });
    await caso("las acciones del detalle siguen los permisos de cada rol", async () => {
      for (const actor of [1, 2, 3, 4]) {
        assert.equal(ofrece(await pagina(detalle(3), actor), "Aprobar"), actor === 1, `actor ${actor}, tarea 3`);
        assert.equal(ofrece(await pagina(detalle(3), actor), espera), actor === 2);
        // El líder también aprueba su propia tarea, y a él no se le dice que espera.
        assert.equal(ofrece(await pagina(detalle(5), actor), "Aprobar"), actor === 1, `actor ${actor}, tarea 5`);
        assert.ok(!ofrece(await pagina(detalle(5), actor), espera), `actor ${actor}, tarea 5 espera`);
        assert.equal(ofrece(await pagina(detalle(1), actor), "Empezar tarea"), actor === 1 || actor === 2);
        // Pasar a revisión ya no es un botón de estado: el responsable ve el acceso a enviar su entrega.
        assert.equal(ofrece(await pagina(detalle(2), actor), "Enviar a revisión"), actor === 2, `actor ${actor}, tarea 2`);
        assert.ok(!ofrece(await pagina(detalle(2), actor), "Aprobar"));
        assert.equal(ofrece(await pagina(detalle(7), actor), "Tomar tarea"), actor !== 4, `actor ${actor}, tarea 7`);
        assert.ok(!ofrece(await pagina(detalle(7), actor), "Empezar tarea"));
        assert.ok(!ofrece(await pagina(detalle(4), actor), "Aprobar"));
        if (actor === 4) assert.ok(!(await pagina(detalle(3), actor)).todo.includes("Siguiente acción"));
      }
    });
    await caso("el tablero y la lista no ofrecen aprobar ni devolver (se hacen en el detalle con la entrega a la vista)", async () => {
      for (const ruta of [lista, tablero]) {
        const pag = await pagina(ruta, 1);
        for (const etiqueta of ["Aprobar", "Devolver"]) assert.ok(!ofrece(pag, etiqueta), `${ruta}: ${etiqueta}`);
      }
    });
    await caso("un filtro sin resultados muestra el estado vacío", async () => {
      assert.ok((await pagina(`${lista}?estado=descartada`)).todo.includes("No hay tareas con estos filtros."));
    });
    await caso("observadores y grupos finalizados no muestran mutaciones", async () => {
      for (const [ruta, actor] of [[lista, 4], [tablero, 4], [detalle(3), 4], ["/grupos/2", 3], [detalle(6, 2), 3], [detalle(9, 2), 3]]) {
        const pag = await pagina(ruta, actor);
        for (const etiqueta of ["Aprobar", "Devolver", "Empezar tarea", "Enviar a revisión", "Tomar tarea", "Asignar a alguien", "Cambiar responsable", "Nueva tarea"]) {
          assert.ok(!ofrece(pag, etiqueta), `${ruta}: ${etiqueta}`);
        }
      }
    });
    await caso("pendientes, retirados y externos no pueden consultar las tareas", async () => {
      for (const actor of [5, 6, 7]) {
        for (const ruta of [lista, detalle(3)]) {
          // proxy responde 404 antes de transmitir la página, y no debe aparecer ningún dato del grupo.
          const respuesta = await fetch(base + ruta, { headers: { Cookie: cookies.get(actor) }, redirect: "manual" });
          assert.equal(respuesta.status, 404, `actor ${actor} en ${ruta}`);
          const contenido = await respuesta.text();
          const todo = contenido + datosRsc(contenido);
          assert.ok(todo.includes("no está disponible para ti"), `actor ${actor} en ${ruta}`);
          for (const dato of ["Grupo HTTP", "Revision HTTP", "Pendiente HTTP", "Aprobar"]) {
            assert.ok(!todo.includes(dato), `actor ${actor} en ${ruta} ve: ${dato}`);
          }
        }
      }
    });
    const aprobar = accion(await pagina(detalle(3), 1), "Aprobar");
    const antes = (await db.query("SELECT * FROM tarea WHERE id_tarea=3")).rows[0];
    const consulta = async (sql, parametros) => (await db.query(sql, parametros)).rows;
    const contar = async (tabla, donde = "TRUE") => (await consulta(`SELECT COUNT(*)::int AS n FROM ${tabla} WHERE ${donde}`))[0].n;
    await caso("una acción de aprobación copiada solo funciona para el líder: asignado, miembros, observador y externos reciben rechazo", async () => {
      for (const actor of [2, 3, 4, 5, 6, 7]) {
        const retorno = await invocar(detalle(3), actor, aprobar, {}, detalle(3), true);
        assert.deepEqual((await db.query("SELECT * FROM tarea WHERE id_tarea=3")).rows[0], antes);
        if ([2, 3].includes(actor)) assert.ok((await pagina(retorno, actor)).todo.includes("Solo el líder puede aprobar o devolver una entrega"), `actor ${actor}`);
      }
      assert.equal(await contar("tarea_historial"), 0);
      assert.equal(await contar("notificacion"), 0);
      assert.deepEqual(await consulta("SELECT resultado FROM entrega WHERE id_tarea=3"), [{ resultado: "en_revision" }]);
    });
    await caso("una acción de devolver copiada por quien no es líder tampoco cambia la tarea", async () => {
      const devolver = accion(await pagina(detalle(8), 1), "Devolver");
      for (const actor of [2, 3, 4, 5, 7]) {
        await invocar(detalle(8), actor, devolver, { motivo: "No corresponde" }, detalle(8), true);
      }
      assert.deepEqual(await consulta("SELECT estado FROM tarea WHERE id_tarea=8"), [{ estado: "en_revision" }]);
      assert.deepEqual(await consulta("SELECT resultado FROM entrega WHERE id_tarea=8"), [{ resultado: "en_revision" }]);
      assert.equal(await contar("tarea_historial"), 0);
    });
    await caso("aprobar desde el detalle completa la tarea, cierra la entrega y notifica al responsable", async () => {
      await invocar(detalle(3), 1, aprobar);
      const actual = (await db.query("SELECT estado,fecha_terminada FROM tarea WHERE id_tarea=3")).rows[0];
      assert.equal(actual.estado, "completada");
      assert.deepEqual(actual.fecha_terminada, antes.fecha_terminada);
      assert.deepEqual(await consulta("SELECT id_usuario,accion,valor_anterior,valor_nuevo FROM tarea_historial WHERE id_tarea=3"),
        [{ id_usuario: 1, accion: "estado", valor_anterior: "en_revision", valor_nuevo: "completada" }]);
      assert.deepEqual(await consulta("SELECT resultado,id_revisor FROM entrega WHERE id_tarea=3"), [{ resultado: "aprobada", id_revisor: 1 }]);
      assert.deepEqual(await consulta("SELECT id_usuario,tipo,estado_correo FROM notificacion"),
        [{ id_usuario: 2, tipo: "tarea_completada", estado_correo: "no_aplica" }]);
      const despues = await pagina(detalle(3), 1);
      assert.ok(!ofrece(despues, "Aprobar"));
      assert.ok(despues.todo.includes("Aprobó y completó la tarea"));
      // Peso completado 4 (tareas 3 y 4) de 10 en el grupo.
      assert.ok((await pagina(lista, 1)).html.includes("width:40%"));
    });
    await caso("repetir la aprobación no duplica historial ni notificaciones", async () => {
      await invocar(detalle(3), 1, aprobar, {}, detalle(3), true);
      assert.equal(await contar("tarea_historial", "id_tarea=3"), 1);
      assert.equal(await contar("notificacion"), 1);
    });
    await caso("devolver exige motivo, cierra la entrega con él, borra la fecha y avisa al responsable; el error conserva vista=tablero", async () => {
      const devolver = accion(await pagina(`${tablero}&tarea=8`, 1), "Devolver");
      const sinMotivo = await invocar(`${tablero}&tarea=8`, 1, devolver, {}, `${tablero}&tarea=8`, true);
      assert.ok(sinMotivo.includes("vista=tablero"), sinMotivo);
      assert.equal((await db.query("SELECT estado FROM tarea WHERE id_tarea=8")).rows[0].estado, "en_revision");
      const retorno = await invocar(`${tablero}&tarea=8`, 1, devolver, { motivo: "Falta el anexo" }, `${tablero}&tarea=8`);
      assert.ok(retorno.includes("vista=tablero"), retorno);
      assert.deepEqual((await db.query("SELECT estado,fecha_terminada FROM tarea WHERE id_tarea=8")).rows[0],
        { estado: "en_progreso", fecha_terminada: null });
      assert.deepEqual(await consulta("SELECT resultado,id_revisor,motivo_devolucion FROM entrega WHERE id_tarea=8"),
        [{ resultado: "devuelta", id_revisor: 1, motivo_devolucion: "Falta el anexo" }]);
      assert.deepEqual(await consulta("SELECT id_usuario,tipo FROM notificacion WHERE tipo='tarea_devuelta'"),
        [{ id_usuario: 2, tipo: "tarea_devuelta" }]);
    });
    await caso("el líder aprueba su propia tarea: queda autoaprobada y se avisa a los demás solo dentro de la app", async () => {
      await invocar(detalle(5), 1, accion(await pagina(detalle(5), 1), "Aprobar"));
      assert.equal((await db.query("SELECT estado FROM tarea WHERE id_tarea=5")).rows[0].estado, "completada");
      assert.deepEqual(await consulta("SELECT id_autor,id_revisor,resultado FROM entrega WHERE id_tarea=5"),
        [{ id_autor: 1, id_revisor: 1, resultado: "aprobada" }]);
      assert.deepEqual(await consulta("SELECT id_usuario,estado_correo FROM notificacion WHERE tipo='tarea_completada' AND id_usuario<>2 ORDER BY id_usuario"),
        [{ id_usuario: 3, estado_correo: "no_aplica" }]);
      assert.equal(await contar("notificacion", "id_usuario=1 OR id_usuario=4"), 0);
      assert.ok((await pagina(detalle(5), 3)).todo.includes("Aprobada por el propio líder"));
    });
    await caso("reasignar valida al responsable y luego se puede empezar", async () => {
      const reasignar = accion(await pagina(detalle(1)), "Cambiar responsable");
      const retorno = await invocar(detalle(1), 3, reasignar, { idAsignado: "1.5" }, detalle(1), true);
      assert.ok((await pagina(retorno)).todo.includes("Selecciona un responsable válido"));
      await invocar(detalle(1), 3, reasignar, { idAsignado: "3" });
      assert.equal((await db.query("SELECT id_asignado FROM tarea WHERE id_tarea=1")).rows[0].id_asignado, 3);
      await invocar(detalle(1), 3, accion(await pagina(detalle(1)), "Empezar tarea"));
      assert.equal((await db.query("SELECT estado FROM tarea WHERE id_tarea=1")).rows[0].estado, "en_progreso");
    });
    await caso("tomar tarea: la toma un integrante, conserva vista=tablero y una copia posterior no la quita", async () => {
      const tomar = accion(await pagina(`${tablero}&tarea=7`, 3), "Tomar tarea");
      for (const actor of [4, 5, 6, 7]) {
        await invocar(detalle(7), actor, tomar, {}, detalle(7), true);
        assert.equal((await db.query("SELECT id_asignado FROM tarea WHERE id_tarea=7")).rows[0].id_asignado, null, `actor ${actor}`);
      }
      const retorno = await invocar(`${tablero}&tarea=7`, 3, tomar, {}, `${tablero}&tarea=7`);
      assert.ok(retorno.includes("vista=tablero"), retorno);
      assert.equal((await db.query("SELECT id_asignado FROM tarea WHERE id_tarea=7")).rows[0].id_asignado, 3);
      assert.deepEqual(await consulta("SELECT id_usuario,accion,valor_anterior,valor_nuevo FROM tarea_historial WHERE id_tarea=7 ORDER BY id_historial"),
        [{ id_usuario: 3, accion: "reasignada", valor_anterior: null, valor_nuevo: "3" }, { id_usuario: 3, accion: "vista", valor_anterior: null, valor_nuevo: null }]);
      assert.equal(await contar("notificacion", "tipo='tarea_asignada'"), 0);
      // Otro integrante que conserva el formulario abierto recibe el aviso de que ya la tomaron.
      const tarde = await invocar(detalle(7), 2, tomar, {}, detalle(7), true);
      assert.ok((await pagina(tarde, 2)).todo.includes("Otra persona ya tomó esta tarea") || (await pagina(tarde, 2)).todo.includes("Esta tarea ya"));
      assert.equal((await db.query("SELECT id_asignado FROM tarea WHERE id_tarea=7")).rows[0].id_asignado, 3);
      const despues = await pagina(detalle(7), 3);
      assert.ok(!ofrece(despues, "Tomar tarea") && ofrece(despues, "Empezar tarea"));
    });
    await caso("el responsable envía su entrega por HTTP: solo él puede, la tarea pasa a revisión, se avisa a los revisores y el líder la aprueba", async () => {
      // La ruta compara el Origin con el host de request.url, que con `next start -H 127.0.0.1` llega como
      // localhost:puerto; con otro Origin responde 403 antes de mirar permisos (la prueba lo distingue con el código 400).
      const origenApi = `http://localhost:${new URL(base).port}`;
      const enviar = async (actor, campos = {}) => {
        const form = new FormData();
        for (const [nombre, valor] of Object.entries({ idGrupo: "1", idTarea: "2", titulo: "Informe final", enlace: "https://example.invalid/informe", ...campos })) form.set(nombre, valor);
        return fetch(`${base}/api/entregas`, { method: "POST", headers: { Cookie: cookies.get(actor), Origin: origenApi }, body: form });
      };
      // El líder, otro miembro, el observador y quien no es integrante no pueden enviar por el responsable.
      for (const actor of [1, 3, 4, 5, 7]) {
        const respuesta = await enviar(actor);
        assert.equal(respuesta.status, 400, `actor ${actor}`);
        assert.equal((await respuesta.json()).ok, false);
      }
      assert.equal((await enviar(2, { enlace: "javascript:alert(1)" })).status, 400);
      assert.equal((await db.query("SELECT estado FROM tarea WHERE id_tarea=2")).rows[0].estado, "en_progreso");
      assert.equal(await contar("entrega", "id_tarea=2"), 0);

      const ok = await enviar(2);
      assert.equal(ok.status, 200);
      assert.equal((await db.query("SELECT estado FROM tarea WHERE id_tarea=2")).rows[0].estado, "en_revision");
      assert.deepEqual(await consulta("SELECT id_autor,resultado FROM entrega WHERE id_tarea=2"), [{ id_autor: 2, resultado: "en_revision" }]);
      assert.deepEqual(await consulta("SELECT id_usuario,tipo FROM notificacion WHERE tipo='tarea_en_revision' ORDER BY id_usuario"),
        [{ id_usuario: 1, tipo: "tarea_en_revision" }, { id_usuario: 3, tipo: "tarea_en_revision" }]);
      // Reenviar con la tarea ya en revisión se rechaza sin duplicar la entrega.
      assert.equal((await enviar(2)).status, 400);
      assert.equal(await contar("entrega", "id_tarea=2"), 1);

      assert.ok(ofrece(await pagina(detalle(2), 2), espera));
      assert.ok(!ofrece(await pagina(detalle(2), 3), "Aprobar"));
      await invocar(detalle(2), 1, accion(await pagina(detalle(2), 1), "Aprobar"));
      assert.equal((await db.query("SELECT estado FROM tarea WHERE id_tarea=2")).rows[0].estado, "completada");
      assert.deepEqual(await consulta("SELECT resultado,id_revisor FROM entrega WHERE id_tarea=2"), [{ resultado: "aprobada", id_revisor: 1 }]);
    });
    await caso("una acción abierta antes de finalizar el grupo se rechaza sin alterar la tarea", async () => {
      await db.query("UPDATE tarea SET estado='en_revision' WHERE id_tarea=1");
      const referencia = accion(await pagina(detalle(1), 1), "Aprobar");
      const historialAntes = (await db.query("SELECT COUNT(*)::int AS n FROM tarea_historial")).rows[0].n;
      await db.query("UPDATE grupo SET estado='finalizado' WHERE id_grupo=1");
      await invocar(detalle(1), 1, referencia, {}, detalle(1), true);
      assert.equal((await db.query("SELECT estado FROM tarea WHERE id_tarea=1")).rows[0].estado, "en_revision");
      assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM tarea_historial")).rows[0].n, historialAntes);
    });
    console.log(`${casos} casos HTTP correctos`);

    if (process.argv.includes("--visual")) {
      // Solo fixtures de la base temporal, en un proxy de loopback ajeno a las rutas de la app.
      await db.query("INSERT INTO grupo (id_grupo,id_creador,nombre) VALUES (3,1,'Equipo del Sprint 1')");
      await db.query(`INSERT INTO grupo_integrante (id_grupo,id_usuario,rol,estado_invitacion) VALUES
        (3,1,'lider','aceptada'),(3,2,'miembro','aceptada'),(3,3,'miembro','aceptada'),(3,4,'observador','aceptada')`);
      await db.query(`INSERT INTO tarea (id_tarea,id_grupo,id_creador,id_asignado,titulo,descripcion,peso,estado,fecha_terminada) VALUES
        (10,3,1,2,'Validar el entregable del Sprint 1','Revisar el informe antes de confirmar la entrega.',3,'en_revision',CURRENT_TIMESTAMP)`);
      await db.query("INSERT INTO entrega (id_tarea,id_autor,titulo,enlace) VALUES (10,2,'Informe del Sprint 1','https://example.invalid/sprint1')");
      proxy = createServer(async (req, res) => {
        try {
          const ruta = new URL(req.url, "http://127.0.0.1");
          const actor = ruta.pathname.match(/^\/__qa\/(1|2|3|4)$/)?.[1];
          if (actor) {
            const vistas = { lista: "/grupos/3", tablero: "/grupos/3?vista=tablero", detalle: "/grupos/3?tarea=10" };
            res.writeHead(302, { "Set-Cookie": `${cookies.get(Number(actor))}; Path=/; HttpOnly; SameSite=Lax`,
              Location: vistas[ruta.searchParams.get("vista")] ?? vistas.lista });
            res.end();
            return;
          }
          const cuerpo = [];
          for await (const parte of req) cuerpo.push(parte);
          const upstream = await fetch(base + req.url, { method: req.method, headers: req.headers,
            body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(cuerpo), redirect: "manual" });
          const headers = Object.fromEntries(upstream.headers);
          delete headers["content-encoding"];
          delete headers["content-length"];
          res.writeHead(upstream.status, headers);
          res.end(Buffer.from(await upstream.arrayBuffer()));
        } catch {
          res.writeHead(500);
          res.end("Error del proxy de prueba");
        }
      });
      await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
      console.log(`Revisión visual: http://127.0.0.1:${proxy.address().port}/__qa/1`);
      console.log("Presiona Enter al terminar para detener los servidores y eliminar la base temporal.");
      await new Promise((resolve) => { process.stdin.resume(); process.stdin.once("data", resolve); });
      process.stdin.pause();
    }
  } finally {
    if (proxy) await new Promise((resolve) => proxy.close(resolve));
    if (servidor && servidor.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(servidor.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
      else servidor.kill();
    }
    if (log !== undefined) fs.closeSync(log);
    await db?.end();
    if (creada) await admin.query(`DROP DATABASE "${nombre}" WITH (FORCE)`);
    await admin.end();
  }
}

verificar().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
