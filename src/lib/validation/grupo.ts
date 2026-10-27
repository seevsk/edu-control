import { z } from "zod";
import { idRegistroSchema } from "./tarea";

const enlaceHttp = z
  .string()
  .trim()
  .refine((valor) => valor === "" || /^https?:\/\//i.test(valor), {
    message: "El enlace debe empezar con http:// o https://",
  });

export const crearGrupoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  descripcion: z.string().trim().max(500).optional().or(z.literal("")),
  idEvaluacion: z.string().optional().or(z.literal("")),
  enlaceTrabajo: enlaceHttp.optional().or(z.literal("")),
});

export const actualizarGrupoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  descripcion: z.string().trim().max(500).optional().or(z.literal("")),
  enlaceTrabajo: enlaceHttp.optional().or(z.literal("")),
  estado: z.enum(["activo", "finalizado"]),
});

export const actualizarPreferenciaCorreoActividadSchema = z.object({
  correoActividad: z.boolean(),
});

export const buscarUsuariosSchema = z.object({
  consulta: z.string().trim().min(1).max(120),
});

export const invitacionGrupoSchema = z.object({
  idGrupo: idRegistroSchema,
  idUsuario: idRegistroSchema,
});

export const responderInvitacionSchema = z.discriminatedUnion("respuesta", [
  z.object({
    idGrupo: idRegistroSchema,
    respuesta: z.literal("aceptada"),
    consentimientoPrivacidad: z.literal("acepto", {
      error: "Confirma que leíste cómo se compartirán tus datos personales",
    }),
  }),
  z.object({
    idGrupo: idRegistroSchema,
    respuesta: z.literal("rechazada"),
  }),
]);
