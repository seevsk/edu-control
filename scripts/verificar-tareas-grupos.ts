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
    const { crearNotificacion } = await import("../src/server/notifications/crear-notificacion");
    const { ErrorDeNegocio } = await import("../src/lib/errores");
    const { invitacionGrupoSchema, responderInvitacionSchema } = await import("../src/lib/validation/grupo");
    const { accionesDisponiblesTarea, ESTADOS_TAREA_ORDEN } = await import("../src/lib/estado-tarea");
    const { contextoTareaSchema } = await import("../src/lib/validation/tarea");
    let casos = 0;
    async function caso(nombreCaso: string, prueba: () => Promise<void>) {
      await prueba();
      casos++;
      console.log(`OK ${nombreCaso}`);
    }
    const todosLosEstados = [...ESTADOS_TAREA_ORDEN, "descartada"] as const;
    await caso("las acciones visibles coinciden con los permisos del servidor en 225 combinaciones", async () => {
      for (const rol of ["lider", "miembro", "observador"] as const) {
        for (const idAsignado of [null, 1, 2]) {
          for (const estado of todosLosEstados) {
            const acciones = accionesDisponiblesTarea({ estado, idAsignado, idUsuario: 1, rol });
            for (const nuevoEstado of todosLosEstados) {
              let permitido = true;
              try {
                tareaService.verificarTransicion({
                  estadoActual: estado,
                  nuevoEstado,
                  tieneAsignado: idAsignado !== null,
                  actorEsAsignado: idAsignado === 1,
                  actorRol: rol,
                });
              } catch (error) {
                assert.ok(error instanceof ErrorDeNegocio);
                permitido = false;
              }
              assert.equal(acciones.some((accion) => accion.estado === nuevoEstado), permitido,
                `${rol}, asignado ${idAsignado}, ${estado} → ${nuevoEstado}`);
            }
          }
        }
      }
    });
    await caso("el retorno acepta solo tablero, tabla o detalle propios de una tarea", async () => {
      for (const destino of ["lista", "tabla", "detalle"]) {
        assert.equal(contextoTareaSchema.safeParse({ idGrupo: 1, idTarea: 1, destino }).success, true);
      }
      for (const destino of ["https://example.invalid", "/otro-grupo", "", "javascript:alert(1)"]) {
        assert.equal(contextoTareaSchema.safeParse({ idGrupo: 1, idTarea: 1, destino }).success, false);
      }
    });
    const usuarios = await Promise.all(["Lider", "Ana", "Luis", "Observador", "Invitado", "Externo"].map((nombreUsuario) =>
      db!.usuario.create({ data: {
        googleId: `prueba-${nombreUsuario}`, correo: `${nombreUsuario.toLowerCase()}@example.invalid`,
        nombre: nombreUsuario, perfil: { create: {} },
      } }),
    ));
    const [lider, ana, luis, observador, invitado, externo] = usuarios.map((usuario) => usuario.idUsuario);
    const fechaLimitePrueba = "2099-12-30";
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
    await caso("cada miembro gestiona solo su preferencia de correo de actividad", async () => {
      await grupoService.actualizarPreferenciaCorreoActividad(ana, idGrupo, false);
      assert.equal(
        (await db!.grupoIntegrante.findUniqueOrThrow({
          where: { idGrupo_idUsuario: { idGrupo, idUsuario: ana } },
        })).correoActividad,
        false,
      );

      const silenciada = await crearNotificacion({
        idUsuario: ana,
        tipo: "tarea_en_revision",
        mensaje: "Una tarea está lista para revisión",
        enlace: `/grupos/${idGrupo}/tareas`,
        asunto: "Tarea en revisión",
        idGrupo,
      });
      assert.equal(silenciada.estadoCorreo, "no_aplica");

      await grupoService.actualizarPreferenciaCorreoActividad(ana, idGrupo, true);
      const habilitada = await crearNotificacion({
        idUsuario: ana,
        tipo: "tarea_en_revision",
        mensaje: "Otra tarea está lista para revisión",
        enlace: `/grupos/${idGrupo}/tareas`,
        asunto: "Tarea en revisión",
        idGrupo,
      });
      assert.equal(
        (await db!.notificacion.findUniqueOrThrow({
          where: { idNotificacion: habilitada.idNotificacion },
        })).estadoCorreo,
        "enviado",
      );

      await assert.rejects(
        grupoService.actualizarPreferenciaCorreoActividad(invitado, idGrupo, false),
        ErrorDeNegocio,
      );
      await assert.rejects(
        grupoService.actualizarPreferenciaCorreoActividad(observador, idGrupo, false),
        ErrorDeNegocio,
      );
      await assert.rejects(
        grupoService.actualizarPreferenciaCorreoActividad(externo, idGrupo, false),
        ErrorDeNegocio,
      );
    });
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
    const tarea = await tareaService.crearTarea(ana, idGrupo, { titulo: "Informe", peso: 2, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
    await caso("el creador queda como líder aceptado y la tarea registra su creación", async () => {
      const miembro = await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo, idUsuario: lider } } });
      assert.equal(miembro.rol, "lider");
      assert.equal(miembro.estadoInvitacion, "aceptada");
      assert.equal(await db!.tareaHistorial.count({ where: { idTarea: tarea.idTarea, accion: "creada" } }), 1);
    });
    for (const actor of [observador, invitado, externo]) {
      await caso(`crear y modificar tareas rechaza al usuario sin permisos ${actor}`, async () => {
        await assert.rejects(tareaService.crearTarea(actor, idGrupo, { titulo: "No permitida", peso: 1, idAsignado: String(actor), fechaLimite: fechaLimitePrueba }), ErrorDeNegocio);
        await assert.rejects(tareaService.reasignarTarea(actor, idGrupo, tarea.idTarea, String(luis)), ErrorDeNegocio);
        await assert.rejects(tareaService.cambiarEstadoTarea(actor, idGrupo, tarea.idTarea, "en_progreso"), ErrorDeNegocio);
      });
    }
    await caso("la asignación rechaza observadores, pendientes y externos", async () => {
      for (const asignado of [observador, invitado, externo]) {
        await assert.rejects(tareaService.reasignarTarea(lider, idGrupo, tarea.idTarea, String(asignado)), ErrorDeNegocio);
      }
    });
    await caso("crear exige responsable y fecha, y una tarea desasignada no puede empezar", async () => {
      const { crearTareaSchema } = await import("../src/lib/validation/tarea");
      assert.equal(crearTareaSchema.safeParse({ titulo: "Incompleta", peso: 1 }).success, false);
      const sinAsignar = await tareaService.crearTarea(ana, idGrupo, {
        titulo: "Pendiente de asignación", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba,
      });
      await tareaService.reasignarTarea(ana, idGrupo, sinAsignar.idTarea, "");
      await assert.rejects(
        tareaService.cambiarEstadoTarea(lider, idGrupo, sinAsignar.idTarea, "en_progreso"),
        ErrorDeNegocio,
      );
      assert.equal((await db!.tarea.findUniqueOrThrow({ where: { idTarea: sinAsignar.idTarea } })).estado, "pendiente");
      await tareaService.reasignarTarea(lider, idGrupo, sinAsignar.idTarea, String(luis));
      await tareaService.cambiarEstadoTarea(luis, idGrupo, sinAsignar.idTarea, "en_progreso");
      await tareaService.cambiarEstadoTarea(luis, idGrupo, sinAsignar.idTarea, "en_revision");
      await tareaService.cambiarEstadoTarea(lider, idGrupo, sinAsignar.idTarea, "completada");
    });
    await caso("las fechas de tarea no admiten pasado ni superar el límite del grupo", async () => {
      const ahora = new Date("2026-11-02T17:00:00.000Z");
      assert.doesNotThrow(() => tareaService.validarFechaLimiteTarea(null, null, ahora));
      assert.doesNotThrow(() => tareaService.validarFechaLimiteTarea(new Date("2026-11-03T04:59:00.000Z"), null, ahora));
      assert.throws(
        () => tareaService.validarFechaLimiteTarea(new Date("2026-11-01T04:59:00.000Z"), null, ahora),
        ErrorDeNegocio,
      );
      assert.throws(
        () => tareaService.validarFechaLimiteTarea(
          new Date("2026-11-05T04:59:00.000Z"),
          new Date("2026-11-04T04:59:00.000Z"),
          ahora,
        ),
        ErrorDeNegocio,
      );
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
        await assert.rejects(tareaService.crearTarea(ana, idGrupo, { titulo: "Creación revertida", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba }));
        assert.equal(await db!.tarea.count({ where: { titulo: "Creación revertida" } }), 0);
      } finally {
        await db!.$executeRawUnsafe("DROP TRIGGER rechazar_historial ON tarea_historial");
        await db!.$executeRawUnsafe("DROP FUNCTION rechazar_historial()");
      }
    });
    await caso("el asignado entrega y otra persona confirma; las fechas se conservan", async () => {
      const actual = await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } });
      await tareaService.cambiarEstadoTarea(actual.idAsignado!, idGrupo, tarea.idTarea, "en_progreso");
      await tareaService.cambiarEstadoTarea(actual.idAsignado!, idGrupo, tarea.idTarea, "en_revision");
      const revision = await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } });
      assert.ok(revision.fechaTerminada);
      await assert.rejects(tareaService.cambiarEstadoTarea(actual.idAsignado!, idGrupo, tarea.idTarea, "completada"), ErrorDeNegocio);
      const revisor = actual.idAsignado === lider ? ana : lider;
      await tareaService.cambiarEstadoTarea(revisor, idGrupo, tarea.idTarea, "completada");
      assert.deepEqual((await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } })).fechaTerminada, revision.fechaTerminada);
    });
    await caso("un miembro puede devolver y completar, con historial y aviso al responsable", async () => {
      const revision = await tareaService.crearTarea(ana, idGrupo, { titulo: "Revisión del equipo", peso: 3, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      await tareaService.cambiarEstadoTarea(ana, idGrupo, revision.idTarea, "en_progreso");
      await tareaService.cambiarEstadoTarea(ana, idGrupo, revision.idTarea, "en_revision");
      await assert.rejects(
        tareaService.cambiarEstadoTarea(luis, idGrupo, revision.idTarea, "en_progreso"),
        ErrorDeNegocio,
      );
      await tareaService.cambiarEstadoTarea(luis, idGrupo, revision.idTarea, "en_progreso", "Debe corregir las conclusiones");
      assert.equal((await db!.tarea.findUniqueOrThrow({ where: { idTarea: revision.idTarea } })).fechaTerminada, null);
      await tareaService.cambiarEstadoTarea(ana, idGrupo, revision.idTarea, "en_revision");
      const avisosAntes = await db!.notificacion.count({ where: { tipo: "tarea_completada", idUsuario: ana } });
      await tareaService.cambiarEstadoTarea(luis, idGrupo, revision.idTarea, "completada");
      assert.equal(await db!.notificacion.count({ where: { tipo: "tarea_completada", idUsuario: ana } }), avisosAntes + 1);
      const historial = await db!.tareaHistorial.findMany({ where: { idTarea: revision.idTarea, accion: "estado" }, orderBy: { idHistorial: "asc" } });
      assert.deepEqual(historial.map((cambio) => [cambio.valorAnterior, cambio.valorNuevo]), [
        ["pendiente", "en_progreso"], ["en_progreso", "en_revision"], ["en_revision", "en_progreso\n\nMotivo de devolución: Debe corregir las conclusiones"],
        ["en_progreso", "en_revision"], ["en_revision", "completada"],
      ]);
      assert.equal(historial.at(-1)?.idUsuario, luis);
      const { obtenerMetricasGrupo } = await import("../src/server/services/metricas");
      assert.equal((await obtenerMetricasGrupo(luis, idGrupo)).avance, 1);
      const historialAntes = await db!.tareaHistorial.count();
      await assert.rejects(tareaService.cambiarEstadoTarea(luis, idGrupo, revision.idTarea, "completada"), ErrorDeNegocio);
      assert.equal(await db!.tareaHistorial.count(), historialAntes);
    });
    await caso("solo el líder descarta, restaura y reabre con motivo; lo descartado sale del avance", async () => {
      const { obtenerMetricasGrupo } = await import("../src/server/services/metricas");
      const ciclo = await tareaService.crearTarea(lider, idGrupo, { titulo: "Ciclo completo", peso: 2, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      await assert.rejects(tareaService.cambiarEstadoTarea(ana, idGrupo, ciclo.idTarea, "descartada", "No aplica"), ErrorDeNegocio);
      await assert.rejects(tareaService.cambiarEstadoTarea(lider, idGrupo, ciclo.idTarea, "descartada"), ErrorDeNegocio);
      await tareaService.cambiarEstadoTarea(lider, idGrupo, ciclo.idTarea, "descartada", "Cambió el alcance");
      assert.equal((await obtenerMetricasGrupo(lider, idGrupo)).avance, 1);
      assert.equal(await db!.notificacion.count({ where: { tipo: "tarea_descartada", idUsuario: ana } }), 1);
      assert.equal((await tareaService.listarTareasDelGrupo(lider, idGrupo, { q: "Ciclo completo" })).length, 0);
      assert.equal((await tareaService.listarTareasDelGrupo(lider, idGrupo, { q: "Ciclo completo", estado: "descartada" })).length, 1);
      await assert.rejects(tareaService.reasignarTarea(lider, idGrupo, ciclo.idTarea, String(luis)), ErrorDeNegocio);
      await assert.rejects(
        tareaService.editarTarea(lider, idGrupo, ciclo.idTarea, { titulo: "x", peso: 1, fechaLimite: fechaLimitePrueba }),
        ErrorDeNegocio,
      );
      await assert.rejects(tareaService.cambiarEstadoTarea(ana, idGrupo, ciclo.idTarea, "pendiente"), ErrorDeNegocio);
      await tareaService.cambiarEstadoTarea(lider, idGrupo, ciclo.idTarea, "pendiente");
      await tareaService.cambiarEstadoTarea(ana, idGrupo, ciclo.idTarea, "en_progreso");
      await tareaService.cambiarEstadoTarea(ana, idGrupo, ciclo.idTarea, "en_revision");
      await tareaService.cambiarEstadoTarea(luis, idGrupo, ciclo.idTarea, "completada");
      await assert.rejects(tareaService.cambiarEstadoTarea(luis, idGrupo, ciclo.idTarea, "en_progreso", "Falta algo"), ErrorDeNegocio);
      await assert.rejects(tareaService.cambiarEstadoTarea(lider, idGrupo, ciclo.idTarea, "en_progreso"), ErrorDeNegocio);
      await tareaService.cambiarEstadoTarea(lider, idGrupo, ciclo.idTarea, "en_progreso", "Faltó la bibliografía");
      const reabierta = await db!.tarea.findUniqueOrThrow({ where: { idTarea: ciclo.idTarea } });
      assert.equal(reabierta.estado, "en_progreso");
      assert.equal(reabierta.fechaTerminada, null);
      assert.equal(await db!.notificacion.count({ where: { tipo: "tarea_reabierta", idUsuario: ana } }), 1);
      await tareaService.cambiarEstadoTarea(ana, idGrupo, ciclo.idTarea, "en_revision");
      await tareaService.cambiarEstadoTarea(luis, idGrupo, ciclo.idTarea, "completada");
      const estados = await db!.tareaHistorial.findMany({ where: { idTarea: ciclo.idTarea, accion: "estado" }, orderBy: { idHistorial: "asc" } });
      assert.deepEqual(estados.map((cambio) => [cambio.valorAnterior, cambio.valorNuevo]), [
        ["pendiente", "descartada\n\nMotivo de descarte: Cambió el alcance"], ["descartada", "pendiente"],
        ["pendiente", "en_progreso"], ["en_progreso", "en_revision"], ["en_revision", "completada"],
        ["completada", "en_progreso\n\nMotivo de reapertura: Faltó la bibliografía"],
        ["en_progreso", "en_revision"], ["en_revision", "completada"],
      ]);
    });
    await caso("editar registra fecha límite y peso; la vista se guarda una vez por asignación", async () => {
      const editable = await tareaService.crearTarea(lider, idGrupo, { titulo: "Editable", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      const cambios = { titulo: "Editada", peso: 3, fechaLimite: "2099-12-15" };
      await assert.rejects(tareaService.editarTarea(luis, idGrupo, editable.idTarea, cambios), ErrorDeNegocio);
      await assert.rejects(tareaService.editarTarea(observador, idGrupo, editable.idTarea, cambios), ErrorDeNegocio);
      await assert.rejects(
        tareaService.editarTarea(lider, idGrupo, editable.idTarea, { ...cambios, fechaLimite: "2020-01-01" }),
        ErrorDeNegocio,
      );
      await tareaService.editarTarea(lider, idGrupo, editable.idTarea, cambios);
      const cambiosHistorial = await db!.tareaHistorial.findMany({
        where: { idTarea: editable.idTarea, accion: { in: ["fecha_limite", "peso"] } },
        orderBy: { idHistorial: "asc" },
      });
      assert.deepEqual(cambiosHistorial.map((cambio) => [cambio.accion, cambio.valorAnterior, cambio.valorNuevo]), [
        ["fecha_limite", new Date("2099-12-30T23:59:00-05:00").toISOString(), new Date("2099-12-15T23:59:00-05:00").toISOString()],
        ["peso", "1", "3"],
      ]);
      assert.equal(await db!.notificacion.count({ where: { tipo: "tarea_reprogramada", idUsuario: ana } }), 1);
      const historialAntes = await db!.tareaHistorial.count({ where: { idTarea: editable.idTarea } });
      await tareaService.editarTarea(lider, idGrupo, editable.idTarea, { ...cambios, titulo: "Solo título" });
      assert.equal(await db!.tareaHistorial.count({ where: { idTarea: editable.idTarea } }), historialAntes);

      const vistas = () => db!.tareaHistorial.count({ where: { idTarea: editable.idTarea, accion: "vista" } });
      await tareaService.registrarVistaTarea(luis, idGrupo, editable.idTarea);
      assert.equal(await vistas(), 0);
      await tareaService.registrarVistaTarea(ana, idGrupo, editable.idTarea);
      await tareaService.registrarVistaTarea(ana, idGrupo, editable.idTarea);
      assert.equal(await vistas(), 1);
      await tareaService.reasignarTarea(lider, idGrupo, editable.idTarea, String(luis));
      await tareaService.registrarVistaTarea(luis, idGrupo, editable.idTarea);
      assert.equal(await vistas(), 2);
      await tareaService.reasignarTarea(lider, idGrupo, editable.idTarea, String(lider));
      assert.equal(await vistas(), 3);
      await tareaService.cambiarEstadoTarea(lider, idGrupo, editable.idTarea, "descartada", "Ya no es necesaria");
    });
    await caso("retirar mientras se asignan tareas nunca deja tareas abiertas del retirado", async () => {
      const grupo = await crearGrupo();
      await tareaService.crearTarea(ana, grupo, { titulo: "Abierta", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      const resultados = await Promise.allSettled([
        grupoService.retirarIntegrante(lider, grupo, ana),
        tareaService.crearTarea(ana, grupo, { titulo: "Asignación simultánea", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba }),
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
    const abierta = await tareaService.crearTarea(ana, idGrupo, { titulo: "Consulta posterior", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
    await caso("solo el líder puede finalizar el grupo", async () => {
      await assert.rejects(grupoService.actualizarGrupo(ana, idGrupo, { nombre: "Grupo", estado: "finalizado" }), ErrorDeNegocio);
      await assert.rejects(grupoService.actualizarGrupo(lider, idGrupo, { nombre: "Grupo", estado: "finalizado" }), ErrorDeNegocio);
      await tareaService.cambiarEstadoTarea(ana, idGrupo, abierta.idTarea, "en_progreso");
      await tareaService.cambiarEstadoTarea(ana, idGrupo, abierta.idTarea, "en_revision");
      await tareaService.cambiarEstadoTarea(lider, idGrupo, abierta.idTarea, "completada");
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
      await assert.rejects(tareaService.crearTarea(lider, idGrupo, { titulo: "No permitida", peso: 1, idAsignado: String(lider), fechaLimite: fechaLimitePrueba }), ErrorDeNegocio);
      await assert.rejects(tareaService.reasignarTarea(lider, idGrupo, abierta.idTarea, String(luis)), ErrorDeNegocio);
      await assert.rejects(tareaService.cambiarEstadoTarea(ana, idGrupo, abierta.idTarea, "en_progreso"), ErrorDeNegocio);
      await assert.rejects(
        grupoService.actualizarPreferenciaCorreoActividad(ana, idGrupo, false),
        ErrorDeNegocio,
      );
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
        assert.equal(
          responderInvitacionSchema.safeParse({
            idGrupo: id,
            respuesta: "aceptada",
            consentimientoPrivacidad: "acepto",
          }).success,
          false,
        );
      }
      assert.equal(responderInvitacionSchema.safeParse({ idGrupo, respuesta: "retirado" }).success, false);
      assert.equal(responderInvitacionSchema.safeParse({ idGrupo, respuesta: "aceptada" }).success, false);
      assert.equal(
        responderInvitacionSchema.safeParse({
          idGrupo,
          respuesta: "aceptada",
          consentimientoPrivacidad: "acepto",
        }).success,
        true,
      );
      assert.equal(responderInvitacionSchema.safeParse({ idGrupo, respuesta: "rechazada" }).success, true);
    });
    console.log(`${casos} casos de integración correctos`);
  } finally {
    await db?.$disconnect();
    process.env.DATABASE_URL = urlOriginal;
    if (creada) await admin.query(`DROP DATABASE "${nombre}" WITH (FORCE)`);
    await admin.end();
  }
}

verificar().catch((error: unknown) => {
  if (error && typeof error === "object") {
    const detalle = error as { name?: unknown; code?: unknown; message?: unknown };
    console.error(
      `Detalle: ${String(detalle.name ?? "Error")} ${String(detalle.code ?? "sin-código")} ${String(detalle.message ?? "sin mensaje")}`,
    );
  } else {
    console.error(`Detalle: ${String(error)}`);
  }
  console.error("Falló la verificación de tareas y grupos. Revisa el último caso mostrado y PostgreSQL local.");
  process.exitCode = 1;
});
