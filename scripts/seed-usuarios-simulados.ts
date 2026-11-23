// Usuarios simulados para experimentar (invitaciones, importacion de cursos, disponibilidad).
// Solo desarrollo. Uso: npx tsx scripts/seed-usuarios-simulados.ts
// Idempotente: upsert por googleId; al re-ejecutar recrea cursos, horarios, evaluaciones y bloques de estos usuarios.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";
import { PrismaClient } from "../generated/prisma/client";

if (process.env.NODE_ENV === "production") {
  console.error("Abortado: este script no se puede ejecutar con NODE_ENV=production.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const COOKIE = "educontrol_session";

// PRNG con semilla fija (mulberry32) para que el resultado sea reproducible.
function crearAleatorio(semilla: number) {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hora(minutos: number) {
  return new Date(Date.UTC(1970, 0, 1, Math.floor(minutos / 60), minutos % 60));
}

// Fecha en America/Lima (UTC-5) a partir de dia, hora y minutos locales.
function limaAUtc(y: number, m: number, d: number, hh: number, mm: number) {
  return new Date(Date.UTC(y, m - 1, d, hh + 5, mm));
}

interface CursoDef {
  nombre: string;
  codigo: string;
  docente: string;
  modalidad: "presencial" | "remoto";
  activo?: boolean;
  sesiones: number; // cantidad de sesiones semanales
  evaluaciones: {
    nombre: string;
    cierre: [number, number, number, number, number]; // y, m, d, hh, mm (Lima)
    apertura?: [number, number, number, number, number];
    requiereEntrega: boolean;
    estado: "pendiente" | "en_progreso";
  }[];
}

interface BloqueDef {
  tipo: "laboral" | "familiar" | "personal";
  dia: number;
  inicio: number; // minutos desde 00:00
  fin: number;
  detalle: string;
}

interface UsuarioDef {
  googleId: string;
  nombre: string;
  apellidos: string;
  perfil: {
    tipoCuenta: "estudiante" | "profesor";
    institucion: string;
    carrera: string;
    ciclo: number | null;
    biografia: string;
    trabaja: boolean;
    visibleEnBusqueda: boolean;
  };
  cursos: CursoDef[];
  bloques: BloqueDef[];
}

const USUARIOS: UsuarioDef[] = [
  {
    googleId: "100000000000000000004",
    nombre: "Diego",
    apellidos: "Quispe",
    perfil: {
      tipoCuenta: "estudiante",
      institucion: "ISIL",
      carrera: "Ingenieria de Software",
      ciclo: 5,
      biografia: "Prefiere dividir el trabajo en tareas chicas y revisar el avance cada semana.",
      trabaja: true,
      visibleEnBusqueda: true,
    },
    cursos: [
      {
        nombre: "Proyecto Tecnologico",
        codigo: "NRC-3708",
        docente: "Luis Paredes",
        modalidad: "presencial",
        sesiones: 2,
        evaluaciones: [
          { nombre: "Avance 1 del proyecto", cierre: [2026, 12, 4, 23, 59], apertura: [2026, 11, 25, 8, 0], requiereEntrega: true, estado: "en_progreso" },
          { nombre: "Exposicion final", cierre: [2026, 12, 18, 20, 0], requiereEntrega: false, estado: "pendiente" },
        ],
      },
      {
        nombre: "Arquitectura de Software",
        codigo: "ARQ-301",
        docente: "Patricia Villanueva",
        modalidad: "remoto",
        sesiones: 1,
        evaluaciones: [
          { nombre: "Caso de estudio", cierre: [2026, 12, 9, 23, 59], apertura: [2026, 12, 2, 0, 0], requiereEntrega: true, estado: "pendiente" },
        ],
      },
      {
        nombre: "Ingles Tecnico IV",
        codigo: "ING-104",
        docente: "Mark Thompson",
        modalidad: "remoto",
        activo: false,
        sesiones: 1,
        evaluaciones: [
          { nombre: "Examen final", cierre: [2026, 11, 30, 23, 59], requiereEntrega: false, estado: "pendiente" },
        ],
      },
    ],
    bloques: [
      { tipo: "laboral", dia: 1, inicio: 8 * 60, fin: 13 * 60, detalle: "Soporte TI en la oficina" },
      { tipo: "laboral", dia: 3, inicio: 8 * 60, fin: 13 * 60, detalle: "Soporte TI en la oficina" },
      { tipo: "personal", dia: 6, inicio: 16 * 60, fin: 18 * 60 + 30, detalle: "Entrenamiento de futbol" },
    ],
  },
  {
    googleId: "100000000000000000005",
    nombre: "Valeria",
    apellidos: "Huaman",
    perfil: {
      tipoCuenta: "estudiante",
      institucion: "ISIL",
      carrera: "Administracion y Marketing Digital",
      ciclo: 3,
      biografia: "Le interesa el diseno de campanas y aprender analitica de datos.",
      trabaja: false,
      visibleEnBusqueda: true,
    },
    cursos: [
      {
        nombre: "Base de Datos II",
        codigo: "BD-202",
        docente: "Rosa Camacho",
        modalidad: "presencial",
        sesiones: 2,
        evaluaciones: [
          { nombre: "Practica calificada 2", cierre: [2026, 12, 2, 21, 0], requiereEntrega: false, estado: "pendiente" },
          { nombre: "Proyecto de modelado", cierre: [2026, 12, 15, 23, 59], apertura: [2026, 12, 1, 8, 0], requiereEntrega: true, estado: "en_progreso" },
        ],
      },
      {
        nombre: "Marketing Digital",
        codigo: "MKT-210",
        docente: "Andrea Salazar",
        modalidad: "remoto",
        sesiones: 2,
        evaluaciones: [
          { nombre: "Plan de campana", cierre: [2026, 12, 11, 23, 59], requiereEntrega: true, estado: "pendiente" },
        ],
      },
      {
        nombre: "Estadistica Aplicada",
        codigo: "EST-150",
        docente: "Julio Cardenas",
        modalidad: "presencial",
        sesiones: 1,
        evaluaciones: [
          { nombre: "Examen parcial", cierre: [2026, 12, 7, 19, 30], requiereEntrega: false, estado: "pendiente" },
          { nombre: "Informe de regresion", cierre: [2026, 12, 20, 23, 59], apertura: [2026, 12, 10, 0, 0], requiereEntrega: true, estado: "pendiente" },
        ],
      },
    ],
    bloques: [
      { tipo: "familiar", dia: 2, inicio: 15 * 60, fin: 17 * 60, detalle: "Cuidar a su hermano menor" },
      { tipo: "familiar", dia: 7, inicio: 10 * 60, fin: 14 * 60, detalle: "Almuerzo familiar" },
    ],
  },
  {
    googleId: "100000000000000000006",
    nombre: "Marco",
    apellidos: "Ccopa",
    perfil: {
      tipoCuenta: "estudiante",
      institucion: "TECSUP",
      carrera: "Electronica y Automatizacion",
      ciclo: 4,
      biografia: "Trabaja por turnos de noche; busca grupos con reuniones por la tarde.",
      trabaja: true,
      visibleEnBusqueda: false,
    },
    cursos: [
      {
        nombre: "Circuitos Digitales",
        codigo: "ELE-240",
        docente: "Ing. Hernan Rojas",
        modalidad: "presencial",
        sesiones: 3,
        evaluaciones: [
          { nombre: "Laboratorio 3", cierre: [2026, 12, 3, 18, 0], requiereEntrega: true, estado: "en_progreso" },
          { nombre: "Examen final", cierre: [2026, 12, 17, 15, 0], requiereEntrega: false, estado: "pendiente" },
        ],
      },
      {
        nombre: "Programacion de PLC",
        codigo: "AUT-310",
        docente: "Carmen Lozano",
        modalidad: "presencial",
        sesiones: 2,
        evaluaciones: [
          { nombre: "Proyecto de automatizacion", cierre: [2026, 12, 14, 23, 59], apertura: [2026, 12, 1, 0, 0], requiereEntrega: true, estado: "pendiente" },
        ],
      },
    ],
    bloques: [
      // Horario excepcional: cruza la medianoche (hora_fin < hora_inicio).
      { tipo: "laboral", dia: 1, inicio: 22 * 60, fin: 6 * 60, detalle: "Turno noche en planta" },
      { tipo: "laboral", dia: 4, inicio: 22 * 60, fin: 6 * 60, detalle: "Turno noche en planta" },
      { tipo: "personal", dia: 6, inicio: 9 * 60, fin: 11 * 60, detalle: "Clases de ingles" },
    ],
  },
  {
    googleId: "100000000000000000007",
    nombre: "Rosa",
    apellidos: "Valdivia",
    perfil: {
      tipoCuenta: "profesor",
      institucion: "ISIL",
      carrera: "Ingenieria de Software",
      ciclo: null,
      biografia: "Docente de cursos de desarrollo web. Acompana grupos como observadora.",
      trabaja: true,
      visibleEnBusqueda: true,
    },
    cursos: [
      {
        nombre: "Desarrollo Web Avanzado",
        codigo: "WEB-320",
        docente: "Rosa Valdivia",
        modalidad: "presencial",
        sesiones: 2,
        evaluaciones: [
          { nombre: "Entrega de proyecto web", cierre: [2026, 12, 12, 23, 59], requiereEntrega: true, estado: "pendiente" },
        ],
      },
      {
        nombre: "Gestion de Proyectos Agiles",
        codigo: "GPA-220",
        docente: "Rosa Valdivia",
        modalidad: "remoto",
        sesiones: 1,
        evaluaciones: [
          { nombre: "Retrospectiva final", cierre: [2026, 12, 16, 22, 0], apertura: [2026, 12, 14, 8, 0], requiereEntrega: false, estado: "en_progreso" },
        ],
      },
    ],
    bloques: [
      { tipo: "laboral", dia: 5, inicio: 14 * 60, fin: 18 * 60, detalle: "Tutorias y asesorias" },
      { tipo: "familiar", dia: 7, inicio: 9 * 60, fin: 13 * 60 + 30, detalle: "Tiempo con la familia" },
    ],
  },
];

// Sesiones de curso: dias 1-6, multiplos de 30 min, duracion de 1.5 a 3 h, entre 7:00 y 22:00, sin solapes entre cursos del mismo usuario.
function generarSesiones(
  aleatorio: () => number,
  cantidad: number,
  ocupado: { dia: number; ini: number; fin: number }[],
) {
  const sesiones: { dia: number; ini: number; fin: number }[] = [];
  const diasUsados = new Set<number>();
  let intentos = 0;
  while (sesiones.length < cantidad && intentos++ < 500) {
    const dia = 1 + Math.floor(aleatorio() * 6);
    if (diasUsados.has(dia)) continue;
    const duracion = 90 + 30 * Math.floor(aleatorio() * 4); // 90..180
    const ini = 7 * 60 + 30 * Math.floor(aleatorio() * 24); // 7:00..18:30
    const fin = ini + duracion;
    if (fin > 22 * 60) continue;
    const choca = ocupado.some((o) => o.dia === dia && ini < o.fin && o.ini < fin);
    if (choca) continue;
    sesiones.push({ dia, ini, fin });
    diasUsados.add(dia);
    ocupado.push({ dia, ini, fin });
  }
  if (sesiones.length < cantidad) throw new Error("No se pudo generar un horario sin solapes");
  return sesiones;
}

async function main() {
  const secretoTexto = process.env.SESSION_SECRET;
  if (!secretoTexto) throw new Error("Falta SESSION_SECRET en .env");
  const secreto = new TextEncoder().encode(secretoTexto);

  const aleatorio = crearAleatorio(20261122);
  const ahora = new Date();

  for (let i = 0; i < USUARIOS.length; i++) {
    const def = USUARIOS[i];
    const correo = `${def.nombre}.${def.apellidos}`.toLowerCase() + "@correo.isil.pe";
    const dominio = correo.split("@")[1];

    const usuario = await prisma.usuario.upsert({
      where: { googleId: def.googleId },
      create: {
        googleId: def.googleId,
        correo,
        dominioCorreo: dominio,
        nombre: def.nombre,
        apellidos: def.apellidos,
        fotoUrl: null,
        perfil: { create: def.perfil },
      },
      update: {
        correo,
        dominioCorreo: dominio,
        nombre: def.nombre,
        apellidos: def.apellidos,
        fotoUrl: null,
        eliminadoEn: null,
      },
    });
    await prisma.perfil.upsert({
      where: { idUsuario: usuario.idUsuario },
      create: { idUsuario: usuario.idUsuario, ...def.perfil },
      update: def.perfil,
    });

    // Limpieza solo de lo de este usuario (cascada: horarios, evaluaciones e historial).
    await prisma.curso.deleteMany({ where: { idUsuario: usuario.idUsuario } });
    await prisma.bloqueOcupado.deleteMany({ where: { idUsuario: usuario.idUsuario } });

    await prisma.bloqueOcupado.createMany({
      data: def.bloques.map((b) => ({
        idUsuario: usuario.idUsuario,
        tipo: b.tipo,
        diaSemana: b.dia,
        horaInicio: hora(b.inicio),
        horaFin: hora(b.fin),
        detalle: b.detalle,
      })),
    });

    // Los cursos activos no deben chocar entre si; los inactivos no entran al calendario, pero tambien se evita el choque.
    const ocupado: { dia: number; ini: number; fin: number }[] = [];
    for (const c of def.cursos) {
      const sesiones = generarSesiones(aleatorio, c.sesiones, ocupado);
      const curso = await prisma.curso.create({
        data: {
          idUsuario: usuario.idUsuario,
          nombre: c.nombre,
          codigo: c.codigo,
          docente: c.docente,
          modalidad: c.modalidad,
          activo: c.activo ?? true,
          horarios: {
            create: sesiones.map((s) => ({
              diaSemana: s.dia,
              horaInicio: hora(s.ini),
              horaFin: hora(s.fin),
            })),
          },
        },
      });
      for (const e of c.evaluaciones) {
        const evaluacion = await prisma.evaluacion.create({
          data: {
            idCurso: curso.idCurso,
            nombre: e.nombre,
            fechaApertura: e.apertura ? limaAUtc(...e.apertura) : null,
            fechaCierre: limaAUtc(...e.cierre),
            requiereEntrega: e.requiereEntrega,
            estado: e.estado,
          },
        });
        await prisma.evaluacionHistorial.create({
          data: { idEvaluacion: evaluacion.idEvaluacion, accion: "creada", fecha: ahora },
        });
        if (e.estado === "en_progreso") {
          await prisma.evaluacionHistorial.create({
            data: {
              idEvaluacion: evaluacion.idEvaluacion,
              accion: "estado",
              valorAnterior: "pendiente",
              valorNuevo: "en_progreso",
              fecha: new Date(ahora.getTime() + 1000),
            },
          });
        }
      }
    }
  }

  // Resumen y tokens de sesion (mismo formato que src/server/auth/session.ts).
  const ids = await prisma.usuario.findMany({
    where: { eliminadoEn: null },
    orderBy: { idUsuario: "asc" },
    include: { _count: { select: { cursos: true, bloquesOcupados: true } } },
  });
  console.log(`\nCookie: ${COOKIE} (HS256, 30 dias)\n`);
  for (const u of ids) {
    const token = await new SignJWT({ idUsuario: u.idUsuario })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${60 * 60 * 24 * 30}s`)
      .sign(secreto);
    console.log(`#${u.idUsuario} ${u.nombre} ${u.apellidos ?? ""} <${u.correo}> cursos=${u._count.cursos} bloques=${u._count.bloquesOcupados}`);
    console.log(`  ${token}\n`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
