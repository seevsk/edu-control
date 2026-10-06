import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";

// Usa una base temporal local; nunca aplica migraciones ni escribe en la base de la app.
async function verificar() {
  config({ quiet: true });
  const urlOriginal = process.env.DATABASE_URL;
  assert.ok(urlOriginal, "Configura DATABASE_URL para PostgreSQL local");
  const url = new URL(urlOriginal);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Solo se permite PostgreSQL local");
  const nombre = `educontrol_verificacion_${randomUUID().replaceAll("-", "")}`;
  assert.match(nombre, /^educontrol_verificacion_[a-f0-9]{32}$/);
  url.pathname = "/postgres";
  url.search = "";
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  let creada = false;
  let db: Awaited<typeof import("../src/server/db/client")>["prisma"] | undefined;
  try {
    await admin.query(`CREATE DATABASE "${nombre}"`);
    creada = true;
    url.pathname = `/${nombre}`;
    process.env.DATABASE_URL = url.toString();
    const conexion = new Client({ connectionString: url.toString() });
    await conexion.connect();
    try {
      const directorio = resolve("prisma/migrations");
      const migraciones = (await readdir(directorio, { withFileTypes: true }))
        .filter((entrada) => entrada.isDirectory()).map((entrada) => entrada.name).sort();
      for (const migracion of migraciones) {
        await conexion.query(await readFile(resolve(directorio, migracion, "migration.sql"), "utf8"));
      }
    } finally {
      await conexion.end();
    }

    db = (await import("../src/server/db/client")).prisma;
    const grupoService = await import("../src/server/services/grupo");
    const tareaService = await import("../src/server/services/tarea");
    const { ErrorDeNegocio } = await import("../src/lib/errores");
    const { invitacionGrupoSchema, responderInvitacionSchema } = await import("../src/lib/validation/grupo");
    let casos = 0;
    async function caso(nombreCaso: string, prueba: () => Promise<void>) {
      await prueba();
      casos++;
      console.log(`OK ${nombreCaso}`);
    }
    const usuarios = await Promise.all(["Lider", "Ana", "Luis", "Observador", "Invitado", "Externo"].map((nombreUsuario) =>
      db!.usuario.create({ data: {
        googleId: `prueba-${nombreUsuario}`, correo: `${nombreUsuario.toLowerCase()}@example.invalid`,
        nombre: nombreUsuario, perfil: { create: {} },
      } }),
    ));
    const [lider, ana, luis, observador, invitado, externo] = usuarios.map((usuario) => usuario.idUsuario);
    async function crearGrupo() {
      const grupo = await grupoService.crearGrupo(lider, { nombre: "Grupo de prueba" });
      await db!.grupoIntegrante.createMany({ data: [
        { idGrupo: grupo.idGrupo, idUsuario: ana, rol: "miembro", estadoInvitacion: "aceptada" },
        { idGrupo: grupo.idGrupo, idUsuario: luis, rol: "miembro", estadoInvitacion: "aceptada" },
        { idGrupo: grupo.idGrupo, idUsuario: observador, rol: "observador", estadoInvitacion: "aceptada" },
        { idGrupo: grupo.idGrupo, idUsuario: invitado, rol: "miembro", estadoInvitacion: "pendiente" },
      ] });
      return grupo.idGrupo;
    }
    const idGrupo = await crearGrupo();
    await caso("los grupos activos permiten invitar y responder con los permisos correctos", async () => {
      const grupo = await crearGrupo();
      await assert.rejects(grupoService.invitarIntegrante(ana, grupo, externo), ErrorDeNegocio);
      await grupoService.invitarIntegrante(lider, grupo, externo);
      await grupoService.responderInvitacion(externo, grupo, "aceptada");
      assert.equal((await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo: grupo, idUsuario: externo } } })).estadoInvitacion, "aceptada");
      await assert.rejects(grupoService.responderInvitacion(externo, grupo, "rechazada"), ErrorDeNegocio);
      await grupoService.responderInvitacion(invitado, grupo, "rechazada");
      assert.equal((await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo: grupo, idUsuario: invitado } } })).estadoInvitacion, "rechazada");
    });
    const tarea = await tareaService.crearTarea(ana, idGrupo, { titulo: "Informe", peso: 2, idAsignado: String(ana) });
    await caso("el creador queda como líder aceptado y la tarea registra su creación", async () => {
      const miembro = await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo, idUsuario: lider } } });
      assert.equal(miembro.rol, "lider");
      assert.equal(miembro.estadoInvitacion, "aceptada");
      assert.equal(await db!.tareaHistorial.count({ where: { idTarea: tarea.idTarea, accion: "creada" } }), 1);
    });
    for (const actor of [observador, invitado, externo]) {
      await caso(`crear y modificar tareas rechaza al usuario sin permisos ${actor}`, async () => {
        await assert.rejects(tareaService.crearTarea(actor, idGrupo, { titulo: "No permitida", peso: 1 }), ErrorDeNegocio);
        await assert.rejects(tareaService.reasignarTarea(actor, idGrupo, tarea.idTarea, String(luis)), ErrorDeNegocio);
        await assert.rejects(tareaService.cambiarEstadoTarea(actor, idGrupo, tarea.idTarea, "en_progreso"), ErrorDeNegocio);
      });
    }
    await caso("la asignación rechaza observadores, pendientes y externos", async () => {
      for (const asignado of [observador, invitado, externo]) {
        await assert.rejects(tareaService.reasignarTarea(lider, idGrupo, tarea.idTarea, String(asignado)), ErrorDeNegocio);
      }
    });
    await caso("dos cambios de estado simultáneos producen un único cambio y su historial", async () => {
      const resultados = await Promise.allSettled([
        tareaService.cambiarEstadoTarea(ana, idGrupo, tarea.idTarea, "en_progreso"),
        tareaService.cambiarEstadoTarea(lider, idGrupo, tarea.idTarea, "en_progreso"),
      ]);
      assert.equal(resultados.filter((resultado) => resultado.status === "fulfilled").length, 1);
      const rechazo = resultados.find((resultado) => resultado.status === "rejected");
      assert.ok(rechazo?.status === "rejected" && rechazo.reason instanceof ErrorDeNegocio);
      const historial = await db!.tareaHistorial.findMany({ where: { idTarea: tarea.idTarea, accion: "estado" } });
      assert.equal(historial.length, 1);
      assert.equal(historial[0].valorAnterior, "pendiente");
      assert.equal(historial[0].valorNuevo, "en_progreso");
      assert.equal((await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } })).estado, "en_progreso");
    });
    await caso("las reasignaciones simultáneas conservan una cadena válida de valores anteriores", async () => {
      const resultados = await Promise.allSettled([
        tareaService.reasignarTarea(lider, idGrupo, tarea.idTarea, String(luis)),
        tareaService.reasignarTarea(ana, idGrupo, tarea.idTarea, String(lider)),
      ]);
      assert.ok(resultados.some((resultado) => resultado.status === "fulfilled"));
      for (const resultado of resultados) {
        if (resultado.status === "rejected") assert.ok(resultado.reason instanceof ErrorDeNegocio);
      }
      const historial = await db!.tareaHistorial.findMany({
        where: { idTarea: tarea.idTarea, accion: "reasignada" }, orderBy: [{ fecha: "asc" }, { idHistorial: "asc" }],
      });
      let anterior = String(ana);
      for (const cambio of historial) {
        assert.equal(cambio.valorAnterior, anterior);
        anterior = cambio.valorNuevo!;
      }
      assert.equal(String((await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } })).idAsignado), anterior);
      assert.equal(historial.length, resultados.filter((resultado) => resultado.status === "fulfilled").length);
    });
    await caso("reasignar al mismo responsable no crea historial ni notificaciones", async () => {
      const actual = await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } });
      const historial = await db!.tareaHistorial.count();
      const notificaciones = await db!.notificacion.count();
      const resultado = await tareaService.reasignarTarea(lider, idGrupo, tarea.idTarea, String(actual.idAsignado));
      assert.equal(resultado.idAsignado, actual.idAsignado);
      assert.equal(await db!.tareaHistorial.count(), historial);
      assert.equal(await db!.notificacion.count(), notificaciones);
    });
    await caso("reasignar devuelve la tarea con su nuevo responsable", async () => {
      const resultado = await tareaService.reasignarTarea(lider, idGrupo, tarea.idTarea, String(ana));
      assert.equal(resultado.idAsignado, ana);
      assert.equal((await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } })).idAsignado, ana);
    });
    await caso("si falla el historial, se revierte la tarea y no se notifica", async () => {
      await db!.$executeRawUnsafe(`CREATE FUNCTION rechazar_historial() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'prueba'; END $$ LANGUAGE plpgsql`);
      await db!.$executeRawUnsafe(`CREATE TRIGGER rechazar_historial BEFORE INSERT ON tarea_historial FOR EACH ROW EXECUTE FUNCTION rechazar_historial()`);
      const antes = await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } });
      const notificaciones = await db!.notificacion.count();
      try {
        await assert.rejects(tareaService.reasignarTarea(lider, idGrupo, tarea.idTarea, ""));
        assert.deepEqual(await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } }), antes);
        assert.equal(await db!.notificacion.count(), notificaciones);
        await assert.rejects(tareaService.cambiarEstadoTarea(antes.idAsignado!, idGrupo, tarea.idTarea, "en_revision"));
        assert.deepEqual(await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } }), antes);
        await assert.rejects(tareaService.crearTarea(ana, idGrupo, { titulo: "Creación revertida", peso: 1 }));
        assert.equal(await db!.tarea.count({ where: { titulo: "Creación revertida" } }), 0);
      } finally {
        await db!.$executeRawUnsafe("DROP TRIGGER rechazar_historial ON tarea_historial");
        await db!.$executeRawUnsafe("DROP FUNCTION rechazar_historial()");
      }
    });
    await caso("el asignado entrega y otra persona confirma; las fechas se conservan", async () => {
      const actual = await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } });
      await tareaService.cambiarEstadoTarea(actual.idAsignado!, idGrupo, tarea.idTarea, "en_revision");
      const revision = await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } });
      assert.ok(revision.fechaTerminada);
      await assert.rejects(tareaService.cambiarEstadoTarea(actual.idAsignado!, idGrupo, tarea.idTarea, "completada"), ErrorDeNegocio);
      const revisor = actual.idAsignado === lider ? ana : lider;
      await tareaService.cambiarEstadoTarea(revisor, idGrupo, tarea.idTarea, "completada");
      assert.deepEqual((await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } })).fechaTerminada, revision.fechaTerminada);
    });
    await caso("retirar mientras se asignan tareas nunca deja tareas abiertas del retirado", async () => {
      const grupo = await crearGrupo();
      await tareaService.crearTarea(ana, grupo, { titulo: "Abierta", peso: 1, idAsignado: String(ana) });
      const resultados = await Promise.allSettled([
        grupoService.retirarIntegrante(lider, grupo, ana),
        tareaService.crearTarea(lider, grupo, { titulo: "Asignación simultánea", peso: 1, idAsignado: String(ana) }),
      ]);
      for (const resultado of resultados) {
        if (resultado.status === "rejected") assert.ok(resultado.reason instanceof ErrorDeNegocio);
      }
      const miembro = await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo: grupo, idUsuario: ana } } });
      if (miembro.estadoInvitacion !== "retirado") await grupoService.retirarIntegrante(lider, grupo, ana);
      assert.equal(await db!.tarea.count({ where: { idGrupo: grupo, idAsignado: ana, estado: { not: "completada" } } }), 0);
      const abiertas = await db!.tarea.findMany({ where: { idGrupo: grupo }, include: { historial: true } });
      for (const abierta of abiertas) {
        assert.ok(abierta.historial.some((cambio) => cambio.accion === "reasignada" && cambio.valorAnterior === String(ana) && cambio.valorNuevo === null));
      }
    });
    const abierta = await tareaService.crearTarea(ana, idGrupo, { titulo: "Consulta posterior", peso: 1, idAsignado: String(ana) });
    await caso("solo el líder puede finalizar el grupo", async () => {
      await assert.rejects(grupoService.actualizarGrupo(ana, idGrupo, { nombre: "Grupo", estado: "finalizado" }), ErrorDeNegocio);
      await grupoService.actualizarGrupo(lider, idGrupo, { nombre: "Grupo finalizado", estado: "finalizado" });
    });
    await caso("un grupo finalizado bloquea edición, reapertura, invitaciones, retiros y tareas", async () => {
      const antes = await db!.grupo.findUniqueOrThrow({ where: { idGrupo } });
      const historial = await db!.tareaHistorial.count();
      const notificaciones = await db!.notificacion.count();
      await assert.rejects(grupoService.actualizarGrupo(lider, idGrupo, { nombre: "Edición", estado: "finalizado" }), ErrorDeNegocio);
      await assert.rejects(grupoService.actualizarGrupo(lider, idGrupo, { nombre: "Reapertura", estado: "activo" }), ErrorDeNegocio);
      await assert.rejects(grupoService.invitarIntegrante(lider, idGrupo, externo), ErrorDeNegocio);
      for (const respuesta of ["aceptada", "rechazada"] as const) {
        await assert.rejects(grupoService.responderInvitacion(invitado, idGrupo, respuesta), ErrorDeNegocio);
      }
      await assert.rejects(grupoService.retirarIntegrante(lider, idGrupo, ana), ErrorDeNegocio);
      await assert.rejects(tareaService.crearTarea(lider, idGrupo, { titulo: "No permitida", peso: 1 }), ErrorDeNegocio);
      await assert.rejects(tareaService.reasignarTarea(lider, idGrupo, abierta.idTarea, String(luis)), ErrorDeNegocio);
      await assert.rejects(tareaService.cambiarEstadoTarea(ana, idGrupo, abierta.idTarea, "en_progreso"), ErrorDeNegocio);
      assert.deepEqual(await db!.grupo.findUniqueOrThrow({ where: { idGrupo } }), antes);
      assert.equal(await db!.tareaHistorial.count(), historial);
      assert.equal(await db!.notificacion.count(), notificaciones);
      assert.equal((await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo, idUsuario: invitado } } })).estadoInvitacion, "pendiente");
    });
    await caso("finalizado conserva el acceso de lectura al grupo, tareas e historial", async () => {
      assert.equal((await grupoService.obtenerGrupoDelUsuario(observador, idGrupo)).grupo.estado, "finalizado");
      assert.equal((await tareaService.obtenerTareaDelGrupo(observador, idGrupo, tarea.idTarea)).estado, "completada");
      assert.equal((await tareaService.listarTareasDelGrupo(ana, idGrupo, { q: "Informe" })).length, 1);
      assert.ok(!(await tareaService.listarTareasAsignadasAlUsuario(ana)).some((item) => item.idGrupo === idGrupo));
    });
    await caso("la validación rechaza identificadores y respuestas inválidas", async () => {
      for (const id of [null, "", 0, -1, 1.5, "abc", 2147483648]) {
        assert.equal(invitacionGrupoSchema.safeParse({ idGrupo: id, idUsuario: ana }).success, false);
        assert.equal(responderInvitacionSchema.safeParse({ idGrupo: id, respuesta: "aceptada" }).success, false);
      }
      assert.equal(responderInvitacionSchema.safeParse({ idGrupo, respuesta: "retirado" }).success, false);
    });
    console.log(`${casos} casos de integración correctos`);
  } finally {
    await db?.$disconnect();
    process.env.DATABASE_URL = urlOriginal;
    if (creada) await admin.query(`DROP DATABASE "${nombre}" WITH (FORCE)`);
    await admin.end();
  }
}

verificar().catch(() => {
  console.error("Falló la verificación de tareas y grupos. Revisa el último caso mostrado y PostgreSQL local.");
  process.exitCode = 1;
});
