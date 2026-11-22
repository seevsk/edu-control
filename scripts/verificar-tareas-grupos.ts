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
    const entregaService = await import("../src/server/services/entrega");
    const perfilService = await import("../src/server/services/perfil");
    const enviar = (actor: number, idTarea: number, archivos: { nombre: string; datos: Uint8Array<ArrayBuffer> }[] = []) =>
      entregaService.enviarEntrega(actor, { idGrupo, idTarea, titulo: "Entrega", descripcion: "Listo para revisar", enlace: "" }, archivos);
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
      assert.ok(silenciada);
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
      assert.ok(habilitada);
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
    const grupoLibre = await crearGrupo();
    await caso("crear sin responsable es válido, no notifica y no puede empezar sin dueño", async () => {
      const { crearTareaSchema } = await import("../src/lib/validation/tarea");
      assert.equal(crearTareaSchema.safeParse({ titulo: "Incompleta", peso: 1 }).success, false);
      assert.equal(crearTareaSchema.safeParse({ titulo: "Libre", peso: 1, fechaLimite: fechaLimitePrueba }).success, true);
      assert.equal(crearTareaSchema.safeParse({ titulo: "Libre", peso: 1, idAsignado: "", fechaLimite: fechaLimitePrueba }).success, true);
      const antes = await db!.notificacion.count({ where: { tipo: "tarea_asignada" } });
      const libre = await tareaService.crearTarea(lider, grupoLibre, { titulo: "Sin dueño", peso: 1, idAsignado: "", fechaLimite: fechaLimitePrueba });
      assert.deepEqual([libre.estado, libre.idAsignado], ["pendiente", null]);
      assert.equal(await db!.notificacion.count({ where: { tipo: "tarea_asignada" } }), antes);
      assert.equal(await db!.tareaHistorial.count({ where: { idTarea: libre.idTarea, accion: { in: ["reasignada", "vista"] } } }), 0);
      for (const actor of [lider, ana]) {
        await assert.rejects(tareaService.cambiarEstadoTarea(actor, grupoLibre, libre.idTarea, "en_progreso"), ErrorDeNegocio);
      }
      // Con responsable distinto del actor se notifica, como siempre.
      await tareaService.crearTarea(lider, grupoLibre, { titulo: "Con dueño", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      assert.equal(await db!.notificacion.count({ where: { tipo: "tarea_asignada" } }), antes + 1);
    });
    await caso("tomar tarea: historial, vista, sin avisar al actor; otros estados y observadores rechazados", async () => {
      const libre = await tareaService.crearTarea(lider, grupoLibre, { titulo: "Para tomar", peso: 2, fechaLimite: fechaLimitePrueba });
      for (const actor of [observador, invitado, externo]) {
        await assert.rejects(tareaService.tomarTarea(actor, grupoLibre, libre.idTarea), ErrorDeNegocio);
      }
      assert.equal((await db!.tarea.findUniqueOrThrow({ where: { idTarea: libre.idTarea } })).idAsignado, null);
      const antes = await db!.notificacion.count({ where: { tipo: "tarea_asignada" } });
      const tomada = await tareaService.tomarTarea(luis, grupoLibre, libre.idTarea);
      assert.equal(tomada.idAsignado, luis);
      assert.equal(await db!.notificacion.count({ where: { tipo: "tarea_asignada" } }), antes);
      const historial = await db!.tareaHistorial.findMany({ where: { idTarea: libre.idTarea }, orderBy: { idHistorial: "asc" } });
      assert.deepEqual(historial.map((h) => [h.accion, h.idUsuario, h.valorAnterior, h.valorNuevo]), [
        ["creada", lider, null, null],
        ["reasignada", luis, null, String(luis)],
        ["vista", luis, null, null],
      ]);
      // Ya tiene dueño: nadie más puede tomarla, ni su dueño otra vez.
      await assert.rejects(tareaService.tomarTarea(ana, grupoLibre, libre.idTarea), /Otra persona ya tomó esta tarea/);
      await assert.rejects(tareaService.tomarTarea(luis, grupoLibre, libre.idTarea), ErrorDeNegocio);
      // Solo las pendientes: una descartada sin responsable no se toma.
      const descartada = await tareaService.crearTarea(lider, grupoLibre, { titulo: "Descartada libre", peso: 1, fechaLimite: fechaLimitePrueba });
      await tareaService.cambiarEstadoTarea(lider, grupoLibre, descartada.idTarea, "descartada", "Ya no hace falta");
      await assert.rejects(tareaService.tomarTarea(ana, grupoLibre, descartada.idTarea), ErrorDeNegocio);
    });
    await caso("dos tomas simultáneas: solo una gana y la otra ve que ya la tomaron", async () => {
      const libre = await tareaService.crearTarea(lider, grupoLibre, { titulo: "Carrera", peso: 1, fechaLimite: fechaLimitePrueba });
      const resultados = await Promise.allSettled([
        tareaService.tomarTarea(ana, grupoLibre, libre.idTarea),
        tareaService.tomarTarea(luis, grupoLibre, libre.idTarea),
      ]);
      assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
      const perdedor = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
      assert.ok(perdedor.reason instanceof ErrorDeNegocio);
      assert.match(perdedor.reason.message, /Otra persona ya tomó esta tarea/);
      const final = await db!.tarea.findUniqueOrThrow({ where: { idTarea: libre.idTarea } });
      assert.ok(final.idAsignado === ana || final.idAsignado === luis);
      assert.equal(await db!.tareaHistorial.count({ where: { idTarea: libre.idTarea, accion: "reasignada" } }), 1);
    });
    await caso("la carga por integrante no cuenta tareas sin asignar y el avance sí", async () => {
      const { calcularMetricasPorIntegrante, calcularAvanceGrupo } = await import("../src/lib/metricas");
      const base = { estado: "pendiente", fechaLimite: null };
      const tareas = [
        { ...base, idTarea: 1, peso: 2, idAsignado: 1 },
        { ...base, idTarea: 2, peso: 2, idAsignado: 2 },
        { ...base, idTarea: 3, peso: 3, idAsignado: null },
        { ...base, idTarea: 4, peso: 3, idAsignado: null, estado: "completada" },
      ];
      const [m1, m2] = calcularMetricasPorIntegrante(tareas, [1, 2]);
      assert.equal(m1.carga, 0.5);
      assert.equal(m2.carga, 0.5);
      assert.equal(calcularMetricasPorIntegrante([{ ...base, idTarea: 5, peso: 3, idAsignado: null }], [1])[0].carga, 0);
      assert.equal(calcularAvanceGrupo(tareas), 3 / 10);
    });
    await caso("crear sin fecha límite sigue siendo obligatorio y una tarea desasignada no puede empezar", async () => {
      await assert.rejects(tareaService.crearTarea(lider, idGrupo, { titulo: "Sin fecha", peso: 1, idAsignado: "", fechaLimite: "" }), ErrorDeNegocio);
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
      await enviar(luis, sinAsignar.idTarea);
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
    await caso("la fecha de una tarea puede caer el mismo día que el límite del grupo (por día en Lima)", async () => {
      const ahora = new Date("2026-11-02T17:00:00.000Z");
      const finDelDia = new Date("2026-11-05T04:59:00.000Z"); // 4 nov 23:59 en Lima
      const grupoAMediaTarde = new Date("2026-11-04T20:00:00.000Z"); // 4 nov 3:00pm en Lima
      assert.doesNotThrow(() => tareaService.validarFechaLimiteTarea(finDelDia, grupoAMediaTarde, ahora));
      assert.throws(
        () => tareaService.validarFechaLimiteTarea(new Date("2026-11-06T04:59:00.000Z"), grupoAMediaTarde, ahora),
        ErrorDeNegocio,
      );
    });
    await caso("al aprobar, devolver o reenviar ninguna entrega anterior queda en revisión", async () => {
      const t = await tareaService.crearTarea(ana, idGrupo, { titulo: "Entregas viejas", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      const enRevision = () => db!.entrega.findMany({ where: { idTarea: t.idTarea, resultado: "en_revision" }, orderBy: { idEntrega: "asc" } });
      const vieja = () => db!.entrega.create({ data: { idTarea: t.idTarea, idAutor: ana, titulo: "Vieja", fechaEnvio: new Date("2020-01-01T00:00:00.000Z") } });
      await tareaService.cambiarEstadoTarea(ana, idGrupo, t.idTarea, "en_progreso");
      await vieja(); // dato heredado que quedó "en revisión"
      await enviar(ana, t.idTarea);
      const vigentes = await enRevision();
      assert.equal(vigentes.length, 1, "enviar deja una sola entrega en revisión");
      assert.equal(vigentes[0].titulo, "Entrega");
      await vieja();
      await tareaService.cambiarEstadoTarea(lider, idGrupo, t.idTarea, "en_progreso", "Falta la conclusión");
      assert.equal((await enRevision()).length, 0, "devolver cierra todas");
      await tareaService.cambiarEstadoTarea(ana, idGrupo, t.idTarea, "en_progreso").catch(() => undefined);
      await vieja();
      await enviar(ana, t.idTarea);
      await vieja();
      await tareaService.cambiarEstadoTarea(lider, idGrupo, t.idTarea, "completada");
      assert.equal((await enRevision()).length, 0, "aprobar cierra todas");
      assert.equal(await db!.entrega.count({ where: { idTarea: t.idTarea, resultado: "aprobada" } }), 1);
    });
    await caso("el motivo del historial usa el separador que aparece primero", async () => {
      const { leerValorEstadoHistorial, valorHistorialConMotivo } = await import("../src/lib/tarea-historial");
      const motivo = "Se pasó de plazo\n\nMotivo de descarte: otra cosa";
      const leido = leerValorEstadoHistorial(valorHistorialConMotivo("en_progreso", "devolver", motivo));
      assert.equal(leido.estado, "en_progreso");
      assert.equal(leido.motivo, motivo);
    });
    await caso("el enlace de una entrega exige una URL con host", async () => {
      const { entregaSchema } = await import("../src/lib/validation/entrega");
      const base = { idGrupo: "1", idTarea: "1", titulo: "T" };
      assert.equal(entregaSchema.safeParse({ ...base, enlace: "https://drive.google.com/x" }).success, true);
      assert.equal(entregaSchema.safeParse({ ...base, enlace: "" }).success, true);
      for (const malo of ["https://", "http:// espacio", "javascript:alert(1)"]) {
        assert.equal(entregaSchema.safeParse({ ...base, enlace: malo }).success, false, malo);
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
        await assert.rejects(enviar(antes.idAsignado!, tarea.idTarea));
        assert.deepEqual(await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } }), antes);
        await assert.rejects(tareaService.crearTarea(ana, idGrupo, { titulo: "Creación revertida", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba }));
        assert.equal(await db!.tarea.count({ where: { titulo: "Creación revertida" } }), 0);
      } finally {
        await db!.$executeRawUnsafe("DROP TRIGGER rechazar_historial ON tarea_historial");
        await db!.$executeRawUnsafe("DROP FUNCTION rechazar_historial()");
      }
    });
    await caso("el asignado entrega y el líder confirma; las fechas se conservan", async () => {
      const actual = await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } });
      await tareaService.cambiarEstadoTarea(actual.idAsignado!, idGrupo, tarea.idTarea, "en_progreso");
      await enviar(actual.idAsignado!, tarea.idTarea);
      const revision = await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } });
      assert.ok(revision.fechaTerminada);
      await assert.rejects(tareaService.cambiarEstadoTarea(actual.idAsignado!, idGrupo, tarea.idTarea, "completada"), ErrorDeNegocio);
      const revisor = actual.idAsignado === lider ? ana : lider;
      await tareaService.cambiarEstadoTarea(revisor, idGrupo, tarea.idTarea, "completada");
      assert.deepEqual((await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } })).fechaTerminada, revision.fechaTerminada);
    });
    await caso("solo el líder devuelve y completa, con historial y aviso al responsable", async () => {
      const revision = await tareaService.crearTarea(ana, idGrupo, { titulo: "Revisión del equipo", peso: 3, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      await tareaService.cambiarEstadoTarea(ana, idGrupo, revision.idTarea, "en_progreso");
      await enviar(ana, revision.idTarea);
      await assert.rejects(
        tareaService.cambiarEstadoTarea(luis, idGrupo, revision.idTarea, "en_progreso"),
        ErrorDeNegocio,
      );
      await assert.rejects(tareaService.cambiarEstadoTarea(luis, idGrupo, revision.idTarea, "en_progreso", "Debe corregir las conclusiones"), ErrorDeNegocio);
      await tareaService.cambiarEstadoTarea(lider, idGrupo, revision.idTarea, "en_progreso", "Debe corregir las conclusiones");
      assert.equal((await db!.tarea.findUniqueOrThrow({ where: { idTarea: revision.idTarea } })).fechaTerminada, null);
      await enviar(ana, revision.idTarea);
      const avisosAntes = await db!.notificacion.count({ where: { tipo: "tarea_completada", idUsuario: ana } });
      await tareaService.cambiarEstadoTarea(lider, idGrupo, revision.idTarea, "completada");
      assert.equal(await db!.notificacion.count({ where: { tipo: "tarea_completada", idUsuario: ana } }), avisosAntes + 1);
      const historial = await db!.tareaHistorial.findMany({ where: { idTarea: revision.idTarea, accion: "estado" }, orderBy: { idHistorial: "asc" } });
      assert.deepEqual(historial.map((cambio) => [cambio.valorAnterior, cambio.valorNuevo]), [
        ["pendiente", "en_progreso"], ["en_progreso", "en_revision"], ["en_revision", "en_progreso\n\nMotivo de devolución: Debe corregir las conclusiones"],
        ["en_progreso", "en_revision"], ["en_revision", "completada"],
      ]);
      assert.equal(historial.at(-1)?.idUsuario, lider);
      const { obtenerMetricasGrupo } = await import("../src/server/services/metricas");
      assert.equal((await obtenerMetricasGrupo(luis, idGrupo)).avance, 1);
      const historialAntes = await db!.tareaHistorial.count();
      await assert.rejects(tareaService.cambiarEstadoTarea(luis, idGrupo, revision.idTarea, "completada"), ErrorDeNegocio);
      assert.equal(await db!.tareaHistorial.count(), historialAntes);
    });
    await caso("la entrega exige contenido válido y solo la envía el responsable; si falla no queda nada", async () => {
      const { validarArchivosEntrega, LIMITES_ENTREGA } = await import("../src/lib/entregas");
      const texto = (contenido: string) => new TextEncoder().encode(contenido);
      const pdf = texto("%PDF-1.4 prueba");
      const t = await tareaService.crearTarea(lider, idGrupo, { titulo: "Con entrega", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      await tareaService.cambiarEstadoTarea(ana, idGrupo, t.idTarea, "en_progreso");
      const sinContenido = entregaService.enviarEntrega(ana, { idGrupo, idTarea: t.idTarea, titulo: "Vacía", descripcion: "", enlace: "" }, []);
      await assert.rejects(sinContenido, ErrorDeNegocio);
      await assert.rejects(enviar(luis, t.idTarea), ErrorDeNegocio);
      await assert.rejects(enviar(lider, t.idTarea), ErrorDeNegocio);
      await assert.rejects(enviar(ana, t.idTarea, [{ nombre: "programa.exe", datos: pdf }]), ErrorDeNegocio);
      await assert.rejects(enviar(ana, t.idTarea, [{ nombre: "falso.pdf", datos: texto("MZ esto no es un pdf") }]), ErrorDeNegocio);
      assert.equal(await db!.entrega.count({ where: { idTarea: t.idTarea } }), 0);
      assert.equal((await db!.tarea.findUniqueOrThrow({ where: { idTarea: t.idTarea } })).estado, "en_progreso");

      await enviar(ana, t.idTarea, [{ nombre: "informe.pdf", datos: pdf }]);
      const entrega = await db!.entrega.findFirstOrThrow({ where: { idTarea: t.idTarea }, include: { archivos: { include: { contenido: true } } } });
      assert.equal(entrega.resultado, "en_revision");
      assert.equal(entrega.archivos[0].tamano, pdf.length);
      assert.equal(entrega.archivos[0].contenido?.datos.length, pdf.length);
      // En revisión ya no se puede volver a enviar, y el estado suelto tampoco sirve.
      await assert.rejects(enviar(ana, t.idTarea), ErrorDeNegocio);
      await assert.rejects(tareaService.cambiarEstadoTarea(ana, idGrupo, t.idTarea, "en_revision"), ErrorDeNegocio);

      await tareaService.cambiarEstadoTarea(lider, idGrupo, t.idTarea, "en_progreso", "Falta la portada");
      const devuelta = await db!.entrega.findUniqueOrThrow({ where: { idEntrega: entrega.idEntrega } });
      assert.deepEqual([devuelta.resultado, devuelta.idRevisor, devuelta.motivoDevolucion], ["devuelta", lider, "Falta la portada"]);
      await enviar(ana, t.idTarea);
      await tareaService.cambiarEstadoTarea(lider, idGrupo, t.idTarea, "completada");
      const entregas = await db!.entrega.findMany({ where: { idTarea: t.idTarea }, orderBy: { idEntrega: "asc" } });
      assert.deepEqual(entregas.map((e) => e.resultado), ["devuelta", "aprobada"]);

      assert.equal(validarArchivosEntrega([{ nombre: "a.pdf", tamano: LIMITES_ENTREGA.bytesPorArchivo + 1 }]) !== null, true);
      assert.equal(validarArchivosEntrega(Array.from({ length: 4 }, (_, i) => ({ nombre: `${i}.png`, tamano: 10 }))) !== null, true);
      assert.equal(validarArchivosEntrega([{ nombre: "a.pdf", tamano: 10 }], LIMITES_ENTREGA.bytesPorGrupo) !== null, true);
      assert.equal(validarArchivosEntrega([{ nombre: "a.pdf", tamano: 10 }]), null);
    });
    await caso("el líder aprueba su propia entrega y se avisa a los demás sin correo", async () => {
      const { esAutoaprobada } = await import("../src/lib/entregas");
      const propia = await tareaService.crearTarea(lider, idGrupo, { titulo: "Tarea del líder", peso: 1, idAsignado: String(lider), fechaLimite: fechaLimitePrueba });
      await tareaService.cambiarEstadoTarea(lider, idGrupo, propia.idTarea, "en_progreso");
      await enviar(lider, propia.idTarea);
      const avisosAntes = await db!.notificacion.count({ where: { tipo: "tarea_completada", idUsuario: ana } });
      await assert.rejects(tareaService.cambiarEstadoTarea(ana, idGrupo, propia.idTarea, "completada"), ErrorDeNegocio);
      await tareaService.cambiarEstadoTarea(lider, idGrupo, propia.idTarea, "completada");
      const entrega = await db!.entrega.findFirstOrThrow({ where: { idTarea: propia.idTarea } });
      assert.equal(esAutoaprobada(entrega), true);
      assert.equal(await db!.notificacion.count({ where: { tipo: "tarea_completada", idUsuario: ana } }), avisosAntes + 1);
      assert.equal(await db!.notificacion.count({ where: { tipo: "tarea_completada", idUsuario: lider } }), 0);
      // Solo los grupos que lidera aparecen en "por revisar".
      const otra = await tareaService.crearTarea(lider, idGrupo, { titulo: "Por revisar", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      await tareaService.cambiarEstadoTarea(ana, idGrupo, otra.idTarea, "en_progreso");
      await enviar(ana, otra.idTarea);
      assert.equal((await tareaService.listarTareasPorRevisar(lider)).some((item) => item.idTarea === otra.idTarea), true);
      assert.equal((await tareaService.listarTareasPorRevisar(luis)).some((item) => item.idTarea === otra.idTarea), false);
      await tareaService.cambiarEstadoTarea(lider, idGrupo, otra.idTarea, "completada");
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
      await enviar(ana, ciclo.idTarea);
      await tareaService.cambiarEstadoTarea(lider, idGrupo, ciclo.idTarea, "completada");
      await assert.rejects(tareaService.cambiarEstadoTarea(luis, idGrupo, ciclo.idTarea, "en_progreso", "Falta algo"), ErrorDeNegocio);
      await assert.rejects(tareaService.cambiarEstadoTarea(lider, idGrupo, ciclo.idTarea, "en_progreso"), ErrorDeNegocio);
      await tareaService.cambiarEstadoTarea(lider, idGrupo, ciclo.idTarea, "en_progreso", "Faltó la bibliografía");
      const reabierta = await db!.tarea.findUniqueOrThrow({ where: { idTarea: ciclo.idTarea } });
      assert.equal(reabierta.estado, "en_progreso");
      assert.equal(reabierta.fechaTerminada, null);
      assert.equal(await db!.notificacion.count({ where: { tipo: "tarea_reabierta", idUsuario: ana } }), 1);
      await enviar(ana, ciclo.idTarea);
      await tareaService.cambiarEstadoTarea(lider, idGrupo, ciclo.idTarea, "completada");
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
    await caso("salir del grupo libera las tareas, avisa al líder y exige ceder el liderazgo", async () => {
      const grupo = await crearGrupo();
      const tarea = await tareaService.crearTarea(ana, grupo, { titulo: "De Ana", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      await grupoService.salirDelGrupo(ana, grupo);
      const salida = await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo: grupo, idUsuario: ana } } });
      assert.equal(salida.estadoInvitacion, "retirado");
      assert.equal(salida.retiroVoluntario, true);
      assert.ok(salida.fechaRetiro);
      assert.equal((await db!.tarea.findUniqueOrThrow({ where: { idTarea: tarea.idTarea } })).idAsignado, null);
      assert.equal(await db!.notificacion.count({ where: { idUsuario: lider, tipo: "integrante_salio" } }), 1);
      await assert.rejects(grupoService.salirDelGrupo(ana, grupo), ErrorDeNegocio);
      await assert.rejects(grupoService.salirDelGrupo(invitado, grupo), ErrorDeNegocio);

      // El líder no sale sin sucesor, ni puede dejar a un observador o a alguien que ya salió.
      await assert.rejects(grupoService.salirDelGrupo(lider, grupo), ErrorDeNegocio);
      await assert.rejects(grupoService.salirDelGrupo(lider, grupo, observador), ErrorDeNegocio);
      await assert.rejects(grupoService.salirDelGrupo(lider, grupo, ana), ErrorDeNegocio);
      await grupoService.salirDelGrupo(lider, grupo, luis);
      const integrantes = await db!.grupoIntegrante.findMany({ where: { idGrupo: grupo, estadoInvitacion: "aceptada", rol: "lider" } });
      assert.deepEqual(integrantes.map((integrante) => integrante.idUsuario), [luis]);
      assert.equal(await db!.notificacion.count({ where: { idUsuario: luis, tipo: "integrante_salio" } }), 1);
    });
    await caso("quien rechazó una invitación puede ser invitado de nuevo; quien salió, no", async () => {
      const persona = await db!.usuario.create({ data: { googleId: "prueba-Rechazante", correo: "rechazante@example.invalid", nombre: "Rechazante", perfil: { create: {} } } });
      // Las pruebas anteriores ya gastaron el cupo de invitaciones por hora: se envejecen para no tropezar con él.
      await db!.grupoIntegrante.updateMany({ data: { fechaInvitacion: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
      await grupoService.invitarIntegrante(lider, idGrupo, persona.idUsuario);
      await grupoService.responderInvitacion(persona.idUsuario, idGrupo, "rechazada");
      await grupoService.invitarIntegrante(lider, idGrupo, persona.idUsuario);
      const fila = await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo, idUsuario: persona.idUsuario } } });
      assert.deepEqual([fila.estadoInvitacion, fila.fechaRespuesta, fila.idInvitador], ["pendiente", null, lider]);
      assert.equal(await db!.grupoIntegrante.count({ where: { idGrupo, idUsuario: persona.idUsuario } }), 1);
      await assert.rejects(grupoService.invitarIntegrante(lider, idGrupo, persona.idUsuario), ErrorDeNegocio);
    });
    await caso("cancelar una invitación pendiente no deja a nadie como retirado y se puede volver a invitar", async () => {
      const persona = await db!.usuario.create({ data: { googleId: "prueba-Equivocado", correo: "equivocado@example.invalid", nombre: "Equivocado", perfil: { create: {} } } });
      const estado = async () => (await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo, idUsuario: persona.idUsuario } } }));
      await db!.grupoIntegrante.updateMany({ data: { fechaInvitacion: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
      await grupoService.invitarIntegrante(lider, idGrupo, persona.idUsuario);
      await assert.rejects(grupoService.cancelarInvitacion(ana, idGrupo, persona.idUsuario), ErrorDeNegocio);
      await grupoService.cancelarInvitacion(lider, idGrupo, persona.idUsuario);
      const cancelada = await estado();
      assert.deepEqual([cancelada.estadoInvitacion, cancelada.fechaRetiro, cancelada.retiroVoluntario], ["cancelada", null, false]);
      await assert.rejects(grupoService.cancelarInvitacion(lider, idGrupo, persona.idUsuario), ErrorDeNegocio);
      assert.equal((await grupoService.listarHistorialInvitaciones(persona.idUsuario)).length, 0);
      assert.equal((await grupoService.listarInvitacionesPendientes(persona.idUsuario)).length, 0);

      // Volver a invitar reabre la misma fila; "Retirar" sobre una pendiente la cancela en vez de retirarla.
      await grupoService.invitarIntegrante(lider, idGrupo, persona.idUsuario);
      assert.equal((await estado()).estadoInvitacion, "pendiente");
      await grupoService.retirarIntegrante(lider, idGrupo, persona.idUsuario);
      assert.equal((await estado()).estadoInvitacion, "cancelada");
      await grupoService.invitarIntegrante(lider, idGrupo, persona.idUsuario);
      assert.equal((await grupoService.listarInvitacionesPendientes(persona.idUsuario)).length, 1);

      // Quien ya fue integrante sigue sin poder volver tras un retiro.
      await grupoService.responderInvitacion(persona.idUsuario, idGrupo, "aceptada");
      await grupoService.retirarIntegrante(lider, idGrupo, persona.idUsuario);
      assert.equal((await estado()).estadoInvitacion, "retirado");
      await assert.rejects(grupoService.invitarIntegrante(lider, idGrupo, persona.idUsuario), ErrorDeNegocio);
      await assert.rejects(grupoService.cancelarInvitacion(lider, idGrupo, persona.idUsuario), ErrorDeNegocio);
    });
    const nuevoUsuario = (nombreUsuario: string) => db!.usuario.create({ data: {
      googleId: `prueba-${nombreUsuario}`, correo: `${nombreUsuario.toLowerCase()}@example.invalid`, nombre: nombreUsuario, perfil: { create: {} },
    } });
    const envejecerInvitaciones = () => db!.grupoIntegrante.updateMany({ data: { fechaInvitacion: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    const filaDe = (idGrupoFila: number, idUsuarioFila: number) =>
      db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo: idGrupoFila, idUsuario: idUsuarioFila } } });
    await caso("se puede invitar como observador y el rol elegido se respeta al reinvitar", async () => {
      const { cambiarRolIntegranteSchema } = await import("../src/lib/validation/grupo");
      assert.equal(invitacionGrupoSchema.safeParse({ idGrupo: 1, idUsuario: 2 }).data?.rol, "miembro");
      assert.equal(invitacionGrupoSchema.safeParse({ idGrupo: 1, idUsuario: 2, rol: "lider" }).success, false);
      assert.equal(cambiarRolIntegranteSchema.safeParse({ idGrupo: 1, idUsuario: 2, rol: "lider" }).success, false);
      const persona = await nuevoUsuario("ObservadorNuevo");
      const grupo = await crearGrupo();
      await envejecerInvitaciones();
      await grupoService.invitarIntegrante(lider, grupo, persona.idUsuario, "observador");
      assert.equal((await filaDe(grupo, persona.idUsuario)).rol, "observador");
      await grupoService.responderInvitacion(persona.idUsuario, grupo, "rechazada");
      await grupoService.invitarIntegrante(lider, grupo, persona.idUsuario);
      assert.equal((await filaDe(grupo, persona.idUsuario)).rol, "miembro");
      await grupoService.responderInvitacion(persona.idUsuario, grupo, "aceptada");

      // Cambio de rol: al pasar a observador se desasignan sus tareas abiertas; el líder no cambia.
      const tareaPersona = await tareaService.crearTarea(lider, grupo, { titulo: "De la persona", peso: 1, idAsignado: String(persona.idUsuario), fechaLimite: fechaLimitePrueba });
      await assert.rejects(grupoService.cambiarRolIntegrante(ana, grupo, persona.idUsuario, "observador"), ErrorDeNegocio);
      await assert.rejects(grupoService.cambiarRolIntegrante(lider, grupo, lider, "observador"), ErrorDeNegocio);
      await assert.rejects(grupoService.cambiarRolIntegrante(lider, grupo, invitado, "observador"), ErrorDeNegocio);
      await grupoService.cambiarRolIntegrante(lider, grupo, persona.idUsuario, "observador");
      assert.equal((await filaDe(grupo, persona.idUsuario)).rol, "observador");
      assert.equal((await db!.tarea.findUniqueOrThrow({ where: { idTarea: tareaPersona.idTarea } })).idAsignado, null);
      await grupoService.cambiarRolIntegrante(lider, grupo, persona.idUsuario, "miembro");
      assert.equal((await filaDe(grupo, persona.idUsuario)).rol, "miembro");
    });
    await caso("invitar por id exige un usuario visible; una fila previa permite reinvitar", async () => {
      const oculto = await db!.usuario.create({ data: {
        googleId: "prueba-Oculto", correo: "oculto@example.invalid", nombre: "Oculto", perfil: { create: { visibleEnBusqueda: false } },
      } });
      const sinPerfil = await db!.usuario.create({ data: { googleId: "prueba-SinPerfil", correo: "sinperfil@example.invalid", nombre: "SinPerfil" } });
      const grupo = await crearGrupo();
      await envejecerInvitaciones();
      for (const idObjetivo of [oculto.idUsuario, sinPerfil.idUsuario, 2147483000]) {
        await assert.rejects(grupoService.invitarIntegrante(lider, grupo, idObjetivo), (error: unknown) =>
          error instanceof ErrorDeNegocio && error.message === "Usuario no encontrado");
      }
      assert.equal(await db!.grupoIntegrante.count({ where: { idGrupo: grupo, idUsuario: oculto.idUsuario } }), 0);
      // Con una fila previa que lo permite (rechazó), se puede reinvitar aunque ahora esté oculto.
      await db!.grupoIntegrante.create({ data: { idGrupo: grupo, idUsuario: oculto.idUsuario, rol: "miembro", estadoInvitacion: "rechazada" } });
      await grupoService.invitarIntegrante(lider, grupo, oculto.idUsuario);
      assert.equal((await filaDe(grupo, oculto.idUsuario)).estadoInvitacion, "pendiente");
    });
    await caso("el límite por hora cuenta las invitaciones de cada invitador, no la fila del creador", async () => {
      const jefe = await nuevoUsuario("JefeLimite");
      const objetivo = await nuevoUsuario("ObjetivoLimite");
      const grupo = await grupoService.crearGrupo(jefe.idUsuario, { nombre: "Límite" });
      // El propio creador no gasta cupo: su fila no es una invitación.
      await grupoService.invitarIntegrante(jefe.idUsuario, grupo.idGrupo, objetivo.idUsuario);
      assert.equal(await db!.grupoIntegrante.count({ where: { idInvitador: jefe.idUsuario } }), 1);
      await db!.usuario.createMany({ data: Array.from({ length: 19 }, (_, i) => ({ googleId: `prueba-Lim${i}`, correo: `lim${i}@example.invalid`, nombre: `Lim${i}` })) });
      const relleno = await db!.usuario.findMany({ where: { googleId: { startsWith: "prueba-Lim" } }, select: { idUsuario: true } });
      await db!.grupoIntegrante.createMany({ data: relleno.map((u) => ({
        idGrupo: grupo.idGrupo, idUsuario: u.idUsuario, rol: "miembro" as const, estadoInvitacion: "pendiente" as const, idInvitador: jefe.idUsuario,
      })) });
      const otro = await nuevoUsuario("OtroLimite");
      await assert.rejects(grupoService.invitarIntegrante(jefe.idUsuario, grupo.idGrupo, otro.idUsuario), /límite de invitaciones/);
      // Quien no invitó a nadie no se ve afectado aunque el grupo tenga muchas invitaciones.
      await grupoService.invitarIntegrante(lider, await crearGrupo(), otro.idUsuario);
    });
    await caso("la fecha límite del grupo se edita con sus reglas", async () => {
      const { actualizarGrupoSchema } = await import("../src/lib/validation/grupo");
      const { fechaEnZonaLimaISO } = await import("../src/lib/calendario");
      assert.equal(actualizarGrupoSchema.safeParse({ nombre: "G", estado: "activo", fechaLimite: "2099-02-31" }).success, false);
      assert.equal(actualizarGrupoSchema.safeParse({ nombre: "G", estado: "activo", fechaLimite: "" }).success, true);
      const grupo = await crearGrupo();
      const base = { nombre: "Grupo de prueba", estado: "activo" as const };
      await tareaService.crearTarea(ana, grupo, { titulo: "Cierre", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      await assert.rejects(grupoService.actualizarGrupo(ana, grupo, { ...base, fechaLimite: "2100-01-01" }), ErrorDeNegocio);
      await assert.rejects(grupoService.actualizarGrupo(lider, grupo, { ...base, fechaLimite: "2020-01-01" }), /pasado/);
      await assert.rejects(grupoService.actualizarGrupo(lider, grupo, { ...base, fechaLimite: "2099-06-01" }), /Hay 1 tarea con fecha posterior/);
      assert.equal((await db!.grupo.findUniqueOrThrow({ where: { idGrupo: grupo } })).fechaLimite, null);
      await grupoService.actualizarGrupo(lider, grupo, { ...base, fechaLimite: "2099-12-30" });
      const guardada = (await db!.grupo.findUniqueOrThrow({ where: { idGrupo: grupo } })).fechaLimite;
      assert.equal(guardada?.toISOString(), "2099-12-31T04:59:00.000Z");
      assert.equal(fechaEnZonaLimaISO(guardada!), "2099-12-30");
      // Sin fecha en el formulario no cambia nada.
      await grupoService.actualizarGrupo(lider, grupo, { ...base, fechaLimite: "" });
      assert.equal((await db!.grupo.findUniqueOrThrow({ where: { idGrupo: grupo } })).fechaLimite?.toISOString(), guardada?.toISOString());
    });
    await caso("un grupo nuevo rechaza evaluaciones vencidas, ajenas o con id inválido", async () => {
      const { crearGrupoSchema } = await import("../src/lib/validation/grupo");
      const curso = await db!.curso.create({ data: { idUsuario: lider, nombre: "Curso de prueba" } });
      const vencida = await db!.evaluacion.create({ data: { idCurso: curso.idCurso, nombre: "Vencida", fechaCierre: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
      const vigente = await db!.evaluacion.create({ data: { idCurso: curso.idCurso, nombre: "Vigente", fechaCierre: new Date("2099-12-30T04:59:00Z") } });
      for (const valor of ["abc", "-1", "0", "1.5", "99999999999"]) {
        assert.equal(crearGrupoSchema.safeParse({ nombre: "G", idEvaluacion: valor }).success, false, valor);
      }
      await assert.rejects(grupoService.crearGrupo(lider, { nombre: "G", idEvaluacion: String(vencida.idEvaluacion) }), /ya cerró/);
      await assert.rejects(grupoService.crearGrupo(ana, { nombre: "G", idEvaluacion: String(vigente.idEvaluacion) }), ErrorDeNegocio);
      const { listarEvaluacionesParaGrupo } = await import("../src/server/services/curso");
      assert.deepEqual((await listarEvaluacionesParaGrupo(lider)).map((evaluacion) => evaluacion.nombre), ["Vigente"]);
      const grupo = await grupoService.crearGrupo(lider, { nombre: "G", idEvaluacion: String(vigente.idEvaluacion) });
      assert.equal(grupo.fechaLimite?.toISOString(), vigente.fechaCierre.toISOString());
    });
    await caso("el historial de la Bandeja omite canceladas y conserva la salida de quien creó el grupo", async () => {
      const { obtenerBandeja, obtenerDetalleInvitacion } = await import("../src/server/services/notificacion");
      const persona = await nuevoUsuario("CanceladaBandeja");
      const grupo = await crearGrupo();
      await envejecerInvitaciones();
      await grupoService.invitarIntegrante(lider, grupo, persona.idUsuario);
      assert.ok(await obtenerDetalleInvitacion(persona.idUsuario, grupo));
      await grupoService.cancelarInvitacion(lider, grupo, persona.idUsuario);
      assert.equal((await obtenerBandeja(persona.idUsuario)).historialInvitaciones.length, 0);
      assert.equal(await obtenerDetalleInvitacion(persona.idUsuario, grupo), null);

      // El creador que sale sí ve su salida; mientras sigue dentro, su propio grupo no aparece.
      assert.ok(!(await obtenerBandeja(lider)).historialInvitaciones.some((registro) => registro.idGrupo === grupo));
      await grupoService.salirDelGrupo(lider, grupo, luis);
      for (const registros of [(await obtenerBandeja(lider)).historialInvitaciones, await grupoService.listarHistorialInvitaciones(lider)]) {
        assert.ok(registros.some((registro) => registro.idGrupo === grupo));
      }
    });
    const motivoLargo = "Falta revisar el informe completo";
    const entregar = (actor: number, grupo: number, idTarea: number) =>
      entregaService.enviarEntrega(actor, { idGrupo: grupo, idTarea, titulo: "Entrega", descripcion: "Listo para revisar", enlace: "" }, []);
    const leerTarea = (idTarea: number) => db!.tarea.findUniqueOrThrow({ where: { idTarea }, include: { historial: true, entregas: true } });
    await caso("al salir, las tareas en progreso vuelven a pendiente y las de revisión conservan a su autor", async () => {
      const grupo = await crearGrupo();
      const crear = (titulo: string) => tareaService.crearTarea(ana, grupo, { titulo, peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
      const pendiente = await crear("Pendiente");
      const enProgreso = await crear("En progreso");
      const enRevision = await crear("En revisión");
      const aprobable = await crear("Aprobable");
      await tareaService.cambiarEstadoTarea(ana, grupo, enProgreso.idTarea, "en_progreso");
      for (const tarea of [enRevision, aprobable]) {
        await tareaService.cambiarEstadoTarea(ana, grupo, tarea.idTarea, "en_progreso");
        await entregar(ana, grupo, tarea.idTarea);
      }
      await grupoService.salirDelGrupo(ana, grupo);

      const p = await leerTarea(pendiente.idTarea);
      assert.deepEqual([p.estado, p.idAsignado], ["pendiente", null]);
      const e = await leerTarea(enProgreso.idTarea);
      assert.deepEqual([e.estado, e.idAsignado, e.fechaTerminada], ["pendiente", null, null]);
      assert.ok(e.historial.some((cambio) => cambio.accion === "reasignada" && cambio.valorAnterior === String(ana) && cambio.valorNuevo === null));
      assert.ok(e.historial.some((cambio) => cambio.accion === "estado" && cambio.valorAnterior === "en_progreso" && cambio.valorNuevo === "pendiente"));
      const r = await leerTarea(enRevision.idTarea);
      assert.deepEqual([r.estado, r.idAsignado, r.entregas.map((entrega) => entrega.resultado)], ["en_revision", ana, ["en_revision"]]);

      // Devolver una tarea cuyo autor ya salió la deja pendiente y sin responsable, nunca en progreso sin dueño.
      await tareaService.cambiarEstadoTarea(lider, grupo, enRevision.idTarea, "en_progreso", motivoLargo);
      const devuelta = await leerTarea(enRevision.idTarea);
      assert.deepEqual([devuelta.estado, devuelta.idAsignado, devuelta.entregas.map((entrega) => entrega.resultado)], ["pendiente", null, ["devuelta"]]);
      assert.ok(devuelta.historial.some((cambio) => cambio.accion === "reasignada" && cambio.valorAnterior === String(ana) && cambio.valorNuevo === null));
      await tareaService.reasignarTarea(lider, grupo, enRevision.idTarea, String(luis));

      // Aprobarla es posible, no avisa a quien salió, y reabrirla la deja pendiente sin responsable.
      const avisosAntes = await db!.notificacion.count({ where: { idUsuario: ana, tipo: "tarea_completada" } });
      await tareaService.cambiarEstadoTarea(lider, grupo, aprobable.idTarea, "completada");
      const aprobada = await leerTarea(aprobable.idTarea);
      assert.deepEqual([aprobada.estado, aprobada.idAsignado, aprobada.entregas.map((entrega) => entrega.resultado)], ["completada", ana, ["aprobada"]]);
      assert.equal(await db!.notificacion.count({ where: { idUsuario: ana, tipo: "tarea_completada" } }), avisosAntes);
      await tareaService.cambiarEstadoTarea(lider, grupo, aprobable.idTarea, "en_progreso", motivoLargo);
      const reabierta = await leerTarea(aprobable.idTarea);
      assert.deepEqual([reabierta.estado, reabierta.idAsignado], ["pendiente", null]);
    });
    await caso("eliminar la cuenta se bloquea si lidera un grupo activo con otros integrantes", async () => {
      const lider2 = await nuevoUsuario("LiderBloqueado");
      const grupoA = await grupoService.crearGrupo(lider2.idUsuario, { nombre: "Grupo A" });
      const grupoB = await grupoService.crearGrupo(lider2.idUsuario, { nombre: "Grupo B" });
      for (const grupo of [grupoA, grupoB]) {
        await db!.grupoIntegrante.create({ data: { idGrupo: grupo.idGrupo, idUsuario: ana, rol: "miembro", estadoInvitacion: "aceptada" } });
      }
      await assert.rejects(
        perfilService.eliminarCuenta(lider2.idUsuario),
        (error) => error instanceof ErrorDeNegocio && error.message === "Cede el liderazgo en: Grupo A, Grupo B",
      );
      assert.equal((await db!.usuario.findUniqueOrThrow({ where: { idUsuario: lider2.idUsuario } })).eliminadoEn, null);
      assert.equal(await db!.perfil.count({ where: { idUsuario: lider2.idUsuario } }), 1);
      assert.equal((await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo: grupoA.idGrupo, idUsuario: lider2.idUsuario } } })).estadoInvitacion, "aceptada");
    });
    await caso("eliminar la cuenta sale de los grupos, libera tareas, cancela invitaciones y es idempotente", async () => {
      const saliente = await nuevoUsuario("Saliente");
      const idSaliente = saliente.idUsuario;
      const grupo = await crearGrupo();
      const otro = await crearGrupo();
      await db!.grupoIntegrante.create({ data: { idGrupo: grupo, idUsuario: idSaliente, rol: "miembro", estadoInvitacion: "aceptada" } });
      await db!.grupoIntegrante.create({ data: { idGrupo: otro, idUsuario: idSaliente, rol: "miembro", estadoInvitacion: "pendiente", idInvitador: lider } });
      const tarea = await tareaService.crearTarea(lider, grupo, { titulo: "Del saliente", peso: 1, idAsignado: String(idSaliente), fechaLimite: fechaLimitePrueba });
      await tareaService.cambiarEstadoTarea(lider, grupo, tarea.idTarea, "en_progreso");
      await db!.bloqueOcupado.create({ data: { idUsuario: idSaliente, tipo: "personal", diaSemana: 1, horaInicio: new Date("1970-01-01T10:00:00Z"), horaFin: new Date("1970-01-01T11:00:00Z") } });

      // Un lider sin otros integrantes que puedan liderar no bloquea: el grupo queda como esta.
      const solitario = await nuevoUsuario("Solitario");
      const grupoSolo = await grupoService.crearGrupo(solitario.idUsuario, { nombre: "Solo" });
      await perfilService.eliminarCuenta(solitario.idUsuario);
      assert.ok((await db!.usuario.findUniqueOrThrow({ where: { idUsuario: solitario.idUsuario } })).eliminadoEn);
      assert.equal((await db!.grupo.findUniqueOrThrow({ where: { idGrupo: grupoSolo.idGrupo } })).estado, "activo");

      await perfilService.eliminarCuenta(idSaliente);
      await perfilService.eliminarCuenta(idSaliente);
      const eliminado = await db!.usuario.findUniqueOrThrow({ where: { idUsuario: idSaliente } });
      assert.ok(eliminado.eliminadoEn);
      assert.equal(eliminado.nombre, "Cuenta eliminada");
      assert.equal(await db!.perfil.count({ where: { idUsuario: idSaliente } }), 0);
      assert.equal(await db!.bloqueOcupado.count({ where: { idUsuario: idSaliente } }), 0);
      const membresia = await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo: grupo, idUsuario: idSaliente } } });
      assert.deepEqual([membresia.estadoInvitacion, membresia.retiroVoluntario, membresia.fechaRetiro !== null], ["retirado", true, true]);
      assert.equal((await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo: otro, idUsuario: idSaliente } } })).estadoInvitacion, "cancelada");
      const liberada = await leerTarea(tarea.idTarea);
      assert.deepEqual([liberada.estado, liberada.idAsignado], ["pendiente", null]);

      // Una cuenta eliminada no recibe avisos.
      const avisos = await db!.notificacion.count({ where: { idUsuario: idSaliente } });
      assert.equal(await crearNotificacion({ idUsuario: idSaliente, tipo: "tarea_asignada", mensaje: "Hola", enlace: "/", asunto: "Hola" }), null);
      assert.equal(await db!.notificacion.count({ where: { idUsuario: idSaliente } }), avisos);
    });
    await caso("finalizar un grupo cancela sus invitaciones pendientes", async () => {
      const grupo = await crearGrupo();
      await grupoService.actualizarGrupo(lider, grupo, { nombre: "Grupo cerrado", estado: "finalizado" });
      const fila = await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo: grupo, idUsuario: invitado } } });
      assert.equal(fila.estadoInvitacion, "cancelada");
    });
    await caso("no se avisa la respuesta a una invitación a quien ya salió del grupo", async () => {
      const grupo = await crearGrupo();
      const persona = await nuevoUsuario("Respondedor");
      await db!.grupoIntegrante.updateMany({ data: { fechaInvitacion: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
      await grupoService.invitarIntegrante(lider, grupo, persona.idUsuario);
      const antes = await db!.notificacion.count({ where: { idUsuario: lider, tipo: "invitacion_respondida" } });
      await grupoService.salirDelGrupo(lider, grupo, luis);
      await grupoService.responderInvitacion(persona.idUsuario, grupo, "aceptada");
      assert.equal(await db!.notificacion.count({ where: { idUsuario: lider, tipo: "invitacion_respondida" } }), antes);
    });
    const abierta = await tareaService.crearTarea(ana, idGrupo, { titulo: "Consulta posterior", peso: 1, idAsignado: String(ana), fechaLimite: fechaLimitePrueba });
    await caso("solo el líder puede finalizar el grupo", async () => {
      await assert.rejects(grupoService.actualizarGrupo(ana, idGrupo, { nombre: "Grupo", estado: "finalizado" }), ErrorDeNegocio);
      await assert.rejects(grupoService.actualizarGrupo(lider, idGrupo, { nombre: "Grupo", estado: "finalizado" }), ErrorDeNegocio);
      await tareaService.cambiarEstadoTarea(ana, idGrupo, abierta.idTarea, "en_progreso");
      await enviar(ana, abierta.idTarea);
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
      assert.equal((await db!.grupoIntegrante.findUniqueOrThrow({ where: { idGrupo_idUsuario: { idGrupo, idUsuario: invitado } } })).estadoInvitacion, "cancelada");
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
