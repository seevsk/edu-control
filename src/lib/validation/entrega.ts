import "./configurar-zod";
import { z } from "zod";
import { idRegistroSchema } from "./tarea";

export const entregaSchema = z.object({
  idGrupo: idRegistroSchema,
  idTarea: idRegistroSchema,
  titulo: z.string().trim().min(1, "El título es obligatorio").max(120, "El título admite hasta 120 caracteres"),
  descripcion: z.string().trim().max(2000, "La descripción admite hasta 2000 caracteres").optional().or(z.literal("")),
  enlace: z
    .string()
    .trim()
    .max(2000, "El enlace es demasiado largo")
    .refine((valor) => valor === "" || /^https?:\/\//i.test(valor), "El enlace debe empezar con http:// o https://")
    .refine((valor) => {
      if (valor === "") return true;
      try {
        const url = new URL(valor);
        return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
      } catch {
        return false;
      }
    }, "El enlace no es una dirección válida")
    .optional(),
});

export type DatosEntrega = z.infer<typeof entregaSchema>;
