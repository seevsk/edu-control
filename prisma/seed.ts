import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function hora(hh: number, mm = 0) {
  return new Date(Date.UTC(1970, 0, 1, hh, mm));
}

async function limpiar() {
  await prisma.notificacion.deleteMany();
  await prisma.tareaHistorial.deleteMany();
  await prisma.tarea.deleteMany();
  await prisma.grupoIntegrante.deleteMany();
  await prisma.grupo.deleteMany();
  await prisma.evaluacion.deleteMany();
  await prisma.horarioCurso.deleteMany();
  await prisma.curso.deleteMany();
  await prisma.bloqueOcupado.deleteMany();
  await prisma.perfil.deleteMany();
  await prisma.usuario.deleteMany();
}

async function main() {
  await limpiar();

  const ana = await prisma.usuario.create({
    data: {
      googleId: "100000000000000000001",
      correo: "ana.torres@correo.isil.pe",
      dominioCorreo: "correo.isil.pe",
      nombre: "Ana",
      apellidos: "Torres",
      fotoUrl: "https://lh3.googleusercontent.com/a/seed-ana",
      perfil: {
        create: {
          tipoCuenta: "estudiante",
          institucion: "ISIL",
          carrera: "Ingenieria de Software",
          ciclo: 5,
          biografia: "Le gusta ordenar el trabajo en grupo antes de que se desordene solo.",
          trabaja: false,
        },
      },
    },
  });

  const bruno = await prisma.usuario.create({
    data: {
      googleId: "100000000000000000002",
      correo: "bruno.rios@correo.isil.pe",
      dominioCorreo: "correo.isil.pe",
      nombre: "Bruno",
      apellidos: "Rios",
      fotoUrl: "https://lh3.googleusercontent.com/a/seed-bruno",
      perfil: {
        create: {
          tipoCuenta: "estudiante",
          institucion: "ISIL",
          carrera: "Ingenieria de Software",
          ciclo: 5,
          trabaja: true,
        },
      },
    },
  });

  const carla = await prisma.usuario.create({
    data: {
      googleId: "100000000000000000003",
      correo: "carla.mendez@correo.isil.pe",
      dominioCorreo: "correo.isil.pe",
      nombre: "Carla",
      apellidos: "Mendez",
      fotoUrl: "https://lh3.googleusercontent.com/a/seed-carla",
      perfil: {
        create: {
          tipoCuenta: "estudiante",
          institucion: "ISIL",
          carrera: "Administracion",
          ciclo: 3,
        },
      },
    },
  });

  await prisma.bloqueOcupado.createMany({
    data: [
      { idUsuario: bruno.idUsuario, tipo: "laboral", diaSemana: 1, horaInicio: hora(18), horaFin: hora(23) },
      { idUsuario: bruno.idUsuario, tipo: "laboral", diaSemana: 3, horaInicio: hora(18), horaFin: hora(23) },
      { idUsuario: ana.idUsuario, tipo: "familiar", diaSemana: 7, horaInicio: hora(12), horaFin: hora(15) },
    ],
  });

  const cursoProyecto = await prisma.curso.create({
    data: {
      idUsuario: ana.idUsuario,
      nombre: "Proyecto Tecnologico",
      codigo: "NRC-3708",
      docente: "Jorge Villanueva",
      modalidad: "presencial",
      horarios: {
        create: [{ diaSemana: 2, horaInicio: hora(19), horaFin: hora(22) }],
      },
      evaluaciones: {
        create: [
          {
            nombre: "Sprint Review 3",
            fechaCierre: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            requiereEntrega: true,
          },
        ],
      },
    },
  });

  await prisma.curso.create({
    data: {
      idUsuario: bruno.idUsuario,
      nombre: "Base de Datos II",
      codigo: "BD-202",
      docente: "Lucia Fernandez",
      modalidad: "remoto",
      horarios: {
        create: [{ diaSemana: 4, horaInicio: hora(20), horaFin: hora(22) }],
      },
      evaluaciones: {
        create: [
          {
            nombre: "Examen final",
            fechaCierre: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            requiereEntrega: false,
          },
        ],
      },
    },
  });

  const grupo = await prisma.grupo.create({
    data: {
      idCreador: ana.idUsuario,
      nombre: "Grupo EduControl",
      descripcion: "Trabajo final de Proyecto Tecnologico",
      idEvaluacion: (await prisma.evaluacion.findFirstOrThrow({ where: { idCurso: cursoProyecto.idCurso } })).idEvaluacion,
      enlaceTrabajo: "https://docs.google.com/document/d/seed-grupo-educontrol",
      integrantes: {
        create: [
          { idUsuario: ana.idUsuario, rol: "lider", estadoInvitacion: "aceptada", fechaRespuesta: new Date() },
          { idUsuario: bruno.idUsuario, rol: "miembro", estadoInvitacion: "aceptada", fechaRespuesta: new Date() },
          { idUsuario: carla.idUsuario, rol: "miembro", estadoInvitacion: "pendiente" },
        ],
      },
    },
  });

  const ahora = new Date();

  const tareaPendiente = await prisma.tarea.create({
    data: {
      idGrupo: grupo.idGrupo,
      idCreador: ana.idUsuario,
      idAsignado: bruno.idUsuario,
      titulo: "Redactar historias de usuario restantes",
      peso: 1,
      estado: "pendiente",
      historial: { create: [{ idUsuario: ana.idUsuario, accion: "creada" }] },
    },
  });

  const tareaEnProgreso = await prisma.tarea.create({
    data: {
      idGrupo: grupo.idGrupo,
      idCreador: ana.idUsuario,
      idAsignado: bruno.idUsuario,
      titulo: "Modelar el esquema de base de datos",
      peso: 2,
      estado: "en_progreso",
      historial: {
        create: [
          { idUsuario: ana.idUsuario, accion: "creada" },
          { idUsuario: bruno.idUsuario, accion: "estado", valorAnterior: "pendiente", valorNuevo: "en_progreso" },
        ],
      },
    },
  });

  const tareaEnRevision = await prisma.tarea.create({
    data: {
      idGrupo: grupo.idGrupo,
      idCreador: ana.idUsuario,
      idAsignado: ana.idUsuario,
      titulo: "Armar el mockup del tablero de tareas",
      peso: 2,
      estado: "en_revision",
      fechaTerminada: ahora,
      historial: {
        create: [
          { idUsuario: ana.idUsuario, accion: "creada" },
          { idUsuario: ana.idUsuario, accion: "estado", valorAnterior: "pendiente", valorNuevo: "en_progreso" },
          { idUsuario: ana.idUsuario, accion: "estado", valorAnterior: "en_progreso", valorNuevo: "en_revision" },
        ],
      },
    },
  });

  await prisma.tarea.create({
    data: {
      idGrupo: grupo.idGrupo,
      idCreador: ana.idUsuario,
      idAsignado: ana.idUsuario,
      titulo: "Levantar Postgres local con Docker",
      peso: 1,
      estado: "completada",
      fechaTerminada: new Date(ahora.getTime() - 2 * 24 * 60 * 60 * 1000),
      historial: {
        create: [
          { idUsuario: ana.idUsuario, accion: "creada" },
          { idUsuario: ana.idUsuario, accion: "estado", valorAnterior: "pendiente", valorNuevo: "en_progreso" },
          { idUsuario: ana.idUsuario, accion: "estado", valorAnterior: "en_progreso", valorNuevo: "en_revision" },
          { idUsuario: bruno.idUsuario, accion: "estado", valorAnterior: "en_revision", valorNuevo: "completada" },
        ],
      },
    },
  });

  await prisma.notificacion.createMany({
    data: [
      {
        idUsuario: carla.idUsuario,
        tipo: "invitacion_grupo",
        mensaje: "Ana Torres te invito al grupo 'Grupo EduControl'.",
        enlace: `/grupos/${grupo.idGrupo}`,
        estadoCorreo: "enviado",
      },
      {
        idUsuario: bruno.idUsuario,
        tipo: "tarea_asignada",
        mensaje: "Se te asigno la tarea 'Modelar el esquema de base de datos'.",
        enlace: `/grupos/${grupo.idGrupo}/tareas/${tareaEnProgreso.idTarea}`,
        estadoCorreo: "enviado",
      },
      {
        idUsuario: bruno.idUsuario,
        tipo: "tarea_en_revision",
        mensaje: "'Armar el mockup del tablero de tareas' esta en revision.",
        enlace: `/grupos/${grupo.idGrupo}/tareas/${tareaEnRevision.idTarea}`,
        estadoCorreo: "enviado",
      },
    ],
  });

  console.log("Seed listo:");
  console.log(`- usuarios: ana(${ana.idUsuario}) bruno(${bruno.idUsuario}) carla(${carla.idUsuario})`);
  console.log(`- grupo: ${grupo.idGrupo} con tareas ${tareaPendiente.idTarea}/${tareaEnProgreso.idTarea}/${tareaEnRevision.idTarea} + 1 completada`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
