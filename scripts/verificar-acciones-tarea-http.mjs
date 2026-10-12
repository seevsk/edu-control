import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { config } from "dotenv";
import { Client } from "pg";
import { SignJWT } from "jose";

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
      (6,2,1,2,'Revision cerrada',1,'en_revision','2026-10-09T15:00:00Z')`);
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
    function formulario(contenido, texto) {
      const form = [...contenido.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)]
        .map((coincidencia) => coincidencia[0]).find((form) => form.includes(texto));
      assert.ok(form, `Falta formulario: ${texto}`);
      const datos = [];
      for (const [tag] of form.matchAll(/<input\b[^>]*>/g)) {
        const nombre = tag.match(/name="([^"]*)"/)?.[1];
        if (nombre?.startsWith("$ACTION_")) {
          const valor = tag.match(/value="([^"]*)"/)?.[1] ?? "";
          datos.push([nombre, valor.replaceAll("&quot;", '"').replaceAll("&amp;", "&")]);
        }
      }
      assert.ok(datos.length, "Falta referencia de Server Action");
      return datos;
    }
    function fila(contenido, titulo) {
      const tabla = contenido.match(/<table\b[^>]*>[\s\S]*?<\/table>/)?.[0];
      assert.ok(tabla, "No se encontró la tabla");
      const row = [...tabla.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map((r) => r[0]).find((r) => r.includes(titulo));
      assert.ok(row, `Falta fila: ${titulo}`);
      return row;
    }
    async function enviar(ruta, actor, referencia, valores = {}, destino = "/grupos/1/tareas?vista=lista", conError = false) {
      const form = new FormData();
      for (const [nombre, valor] of referencia) form.set(nombre, valor);
      for (const [nombre, valor] of Object.entries(valores)) form.set(nombre, valor);
      const respuesta = await fetch(base + ruta, {
        method: "POST", headers: { Cookie: cookies.get(actor), Origin: base }, body: form, redirect: "manual",
      });
      assert.equal(respuesta.status, 303);
      const retorno = new URL(respuesta.headers.get("location"), base);
      const esperado = new URL(destino, base);
      assert.equal(retorno.origin, base);
      assert.equal(retorno.pathname, esperado.pathname);
      assert.equal(retorno.searchParams.get("vista"), esperado.searchParams.get("vista"));
      assert.equal(Boolean(retorno.searchParams.get("error")), conError);
      return retorno.pathname + retorno.search;
    }
    const listado = "/grupos/1/tareas?vista=lista";
    const tablero = "/grupos/1/tareas";
    const detalle = "/grupos/1/tareas/3";
    const espera = "Pendiente de aprobación por otro integrante.";
    await caso("tablero, lista y detalle muestran aprobación al revisor y espera al responsable", async () => {
      for (const ruta of [listado, tablero, detalle]) {
        const revisor = await html(ruta);
        assert.ok(revisor.includes("Aprobar y completar") && revisor.includes("Devolver a progreso"));
        const responsable = await html(ruta, 2);
        assert.ok(responsable.includes(espera));
        if (ruta === detalle) assert.ok(!responsable.includes("Aprobar y completar"));
      }
    });
    await caso("cada fila aplica los permisos y destaca el botón de completar", async () => {
      for (const actor of [1, 2, 3, 4]) {
        const tabla = await html(listado, actor);
        const revision = fila(tabla, "Revision HTTP");
        assert.equal(revision.includes("Aprobar y completar"), actor === 1 || actor === 3);
        assert.equal(revision.includes(espera), actor === 2);
        assert.equal(fila(tabla, "Revision del lider").includes("Aprobar y completar"), actor === 2 || actor === 3);
        assert.equal(fila(tabla, "Pendiente HTTP").includes("Empezar tarea"), actor === 1 || actor === 2);
        assert.equal(fila(tabla, "Progreso HTTP").includes("Enviar a revisión"), actor === 2);
        assert.ok(!fila(tabla, "Completada HTTP").includes("Aprobar y completar"));
        if (actor === 3) assert.match(revision, /<button[^>]*bg-primary text-white[^>]*>Aprobar y completar<\/button>/);
        if (actor === 4) assert.ok(!tabla.match(/<th[^>]*>Acciones<\/th>/));
      }
    });
    await caso("la fila vacía conserva las columnas correctas según permisos", async () => {
      assert.ok((await html(`${listado}&q=Inexistente`)).includes('colSpan="6"'));
      assert.ok((await html(`${listado}&q=Inexistente`, 4)).includes('colSpan="5"'));
    });
    await caso("observadores y grupos finalizados no muestran mutaciones", async () => {
      for (const ruta of [listado, tablero, detalle, "/grupos/2/tareas?vista=lista", "/grupos/2/tareas/6"]) {
        const contenido = await html(ruta, ruta.includes("/grupos/2/") ? 3 : 4);
        for (const accion of ["Aprobar y completar", "Devolver a progreso", "Empezar tarea", "Enviar a revisión", "Reasignar"]) {
          assert.ok(!contenido.includes(`>${accion}<`), ruta);
        }
      }
    });
    await caso("pendientes, retirados y externos no pueden consultar las tareas", async () => {
      for (const actor of [5, 6, 7]) {
        const respuesta = await fetch(base + listado, { headers: { Cookie: cookies.get(actor) }, redirect: "manual" });
        assert.equal(respuesta.status, 404);
      }
    });
    const tablaInicial = await html(listado);
    const aprobar = formulario(fila(tablaInicial, "Revision HTTP"), "Aprobar y completar");
    const antes = (await db.query("SELECT * FROM tarea WHERE id_tarea=3")).rows[0];
    await caso("formularios de aprobación copiados no permiten autoaprobar ni eludir permisos", async () => {
      for (const actor of [2, 4, 5, 6, 7]) {
        const retorno = await enviar(listado, actor, aprobar, {}, undefined, true);
        assert.deepEqual((await db.query("SELECT * FROM tarea WHERE id_tarea=3")).rows[0], antes);
        if (actor === 2) {
          assert.ok((await html(retorno, actor)).includes("El asignado no puede confirmar"));
        }
      }
      assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM tarea_historial")).rows[0].n, 0);
      assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM notificacion")).rows[0].n, 0);
    });
    await caso("aprobar desde la lista completa la tarea, registra el actor y notifica al responsable", async () => {
      await enviar(listado, 3, aprobar);
      const actual = (await db.query("SELECT estado,fecha_terminada FROM tarea WHERE id_tarea=3")).rows[0];
      assert.equal(actual.estado, "completada");
      assert.deepEqual(actual.fecha_terminada, antes.fecha_terminada);
      const cambios = (await db.query("SELECT id_usuario,accion,valor_anterior,valor_nuevo FROM tarea_historial WHERE id_tarea=3")).rows;
      assert.deepEqual(cambios, [{ id_usuario: 3, accion: "estado", valor_anterior: "en_revision", valor_nuevo: "completada" }]);
      assert.deepEqual((await db.query("SELECT id_usuario,tipo,estado_correo FROM notificacion")).rows,
        [{ id_usuario: 2, tipo: "tarea_completada", estado_correo: "no_aplica" }]);
      assert.ok(!fila(await html(listado), "Revision HTTP").includes("Aprobar y completar"));
      assert.ok((await html(detalle)).includes("Cambió el estado de En revisión a Completada"));
      assert.ok((await html("/grupos/1")).includes("50%"));
    });
    await caso("repetir la aprobación no duplica historial ni notificaciones", async () => {
      await enviar(listado, 3, aprobar, {}, undefined, true);
      assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM tarea_historial WHERE id_tarea=3")).rows[0].n, 1);
      assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM notificacion")).rows[0].n, 1);
    });
    await caso("devolver desde la lista conserva la vista y borra la fecha de entrega", async () => {
      const devolver = formulario(fila(await html(listado), "Revision del lider"), "Devolver a progreso");
      await enviar(listado, 3, devolver);
      assert.deepEqual((await db.query("SELECT estado,fecha_terminada FROM tarea WHERE id_tarea=5")).rows[0],
        { estado: "en_progreso", fecha_terminada: null });
    });
    await caso("reasignar y los errores de validación conservan la lista", async () => {
      const reasignar = formulario(fila(await html(listado), "Pendiente HTTP"), 'name="idAsignado"');
      const retorno = await enviar(listado, 3, reasignar, { idAsignado: "1.5" }, undefined, true);
      assert.ok((await html(retorno)).includes("Selecciona un responsable valido"));
      await enviar(listado, 3, reasignar, { idAsignado: "3" });
      assert.equal((await db.query("SELECT id_asignado FROM tarea WHERE id_tarea=1")).rows[0].id_asignado, 3);
      const empezar = formulario(fila(await html(listado), "Pendiente HTTP"), "Empezar tarea");
      await enviar(listado, 3, empezar);
      assert.equal((await db.query("SELECT estado FROM tarea WHERE id_tarea=1")).rows[0].estado, "en_progreso");
    });
    await caso("el responsable entrega desde la lista y el revisor completa desde el detalle", async () => {
      const enviarRevision = formulario(fila(await html(listado, 2), "Progreso HTTP"), "Enviar a revisión");
      await enviar(listado, 2, enviarRevision);
      const ruta = "/grupos/1/tareas/2";
      assert.ok((await html(ruta, 2)).includes(espera));
      await enviar(ruta, 3, formulario(await html(ruta), "Aprobar y completar"), {}, ruta);
      assert.equal((await db.query("SELECT estado FROM tarea WHERE id_tarea=2")).rows[0].estado, "completada");
    });
    await caso("un formulario abierto antes de finalizar el grupo se rechaza sin alterar la tarea", async () => {
      await db.query("UPDATE tarea SET estado='en_revision' WHERE id_tarea=1");
      const referencia = formulario(fila(await html(listado, 1), "Pendiente HTTP"), "Aprobar y completar");
      const historialAntes = (await db.query("SELECT COUNT(*)::int AS n FROM tarea_historial")).rows[0].n;
      await db.query("UPDATE grupo SET estado='finalizado' WHERE id_grupo=1");
      await enviar(listado, 1, referencia, {}, undefined, true);
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
      proxy = createServer(async (req, res) => {
        try {
          const ruta = new URL(req.url, "http://127.0.0.1");
          const actor = ruta.pathname.match(/^\/__qa\/(1|2|3|4)$/)?.[1];
          if (actor) {
            const vistas = { lista: "/grupos/3/tareas?vista=lista", tablero: "/grupos/3/tareas", detalle: "/grupos/3/tareas/10" };
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
      console.log(`Revisión visual: http://127.0.0.1:${proxy.address().port}/__qa/3`);
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
