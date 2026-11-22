import { prisma } from "@/server/db/client";
import { ErrorDeNegocio } from "@/lib/errores";
import {
  firmaCoincide,
  mimeDe,
  tieneContenidoEntrega,
  validarArchivosEntrega,
} from "@/lib/entregas";
import type { DatosEntrega } from "@/lib/validation/entrega";
import { ejecutarCambioDeGrupo } from "./cambio-grupo";
import {
  notificarTareaEnRevision,
  requerirIntegranteActivo,
  requerirIntegranteQuePuedeModificar,
} from "./tarea";

export interface ArchivoSubido {
  nombre: string;
  datos: Uint8Array<ArrayBuffer>;
}

/** Nombre sin rutas ni caracteres de control: se guarda y se devuelve tal cual en la descarga. */
function nombreSeguro(nombre: string) {
  const base = nombre.split(/[\\/]/).pop() ?? "archivo";
  return base.replace(/[\u0000-\u001f"<>|:*?]/g, "_").trim().slice(0, 200) || "archivo";
}

/**
 * El asignado envia su entrega: crea la entrega con sus archivos y pasa la tarea a revision en una
 * sola transaccion. Si algo falla no queda nada a medias.
 */
export async function enviarEntrega(
  idActor: number,
  datos: Pick<DatosEntrega, "idGrupo" | "idTarea" | "titulo" | "descripcion" | "enlace">,
  archivos: ArchivoSubido[],
) {
  const { idGrupo, idTarea } = datos;
  const tarea = await ejecutarCambioDeGrupo(
    async (tx) => {
      await requerirIntegranteQuePuedeModificar(idActor, idGrupo, tx);
      const actual = await tx.tarea.findFirst({ where: { idTarea, idGrupo } });
      if (!actual) throw new ErrorDeNegocio("Tarea no encontrada");
      if (actual.idAsignado !== idActor) throw new ErrorDeNegocio("Solo el responsable puede enviar la entrega");
      if (actual.estado !== "en_progreso") throw new ErrorDeNegocio("La tarea debe estar en progreso para enviarla a revisión");
      if (!tieneContenidoEntrega(datos, archivos.length)) {
        throw new ErrorDeNegocio("Agrega una descripción, un enlace o al menos un archivo");
      }

      // Cupo del grupo: se suma lo ya guardado dentro de la transaccion para que dos envios no lo superen.
      const usados = await tx.entregaArchivo.aggregate({
        _sum: { tamano: true },
        where: { entrega: { tarea: { idGrupo } } },
      });
      const error = validarArchivosEntrega(
        archivos.map((archivo) => ({ nombre: archivo.nombre, tamano: archivo.datos.length })),
        usados._sum.tamano ?? 0,
      );
      if (error) throw new ErrorDeNegocio(error);
      for (const archivo of archivos) {
        if (!firmaCoincide(archivo.nombre, archivo.datos.subarray(0, 8))) {
          throw new ErrorDeNegocio(`“${archivo.nombre}” no corresponde a su tipo de archivo`);
        }
      }

      // Una entrega nueva reemplaza a cualquier anterior que siguiera esperando revisión.
      await tx.entrega.updateMany({ where: { idTarea, resultado: "en_revision" }, data: { resultado: "devuelta" } });
      await tx.entrega.create({
        data: {
          idTarea,
          idAutor: idActor,
          titulo: datos.titulo,
          descripcion: datos.descripcion || null,
          enlace: datos.enlace || null,
          archivos: {
            create: archivos.map((archivo) => ({
              nombre: nombreSeguro(archivo.nombre),
              mime: mimeDe(archivo.nombre),
              tamano: archivo.datos.length,
              contenido: { create: { datos: archivo.datos } },
            })),
          },
        },
      });
      await tx.tarea.update({ where: { idTarea }, data: { estado: "en_revision", fechaTerminada: new Date() } });
      await tx.tareaHistorial.create({
        data: { idTarea, idUsuario: idActor, accion: "estado", valorAnterior: "en_progreso", valorNuevo: "en_revision" },
      });
      return actual;
    },
    { timeout: 30_000 },
  );

  await notificarTareaEnRevision(idGrupo, idTarea, tarea.titulo, tarea.idAsignado);
}

/** Descarga: cualquier integrante aceptado del grupo (tambien observadores y grupos finalizados). */
export async function obtenerArchivoEntrega(idUsuario: number, idArchivo: number) {
  const archivo = await prisma.entregaArchivo.findUnique({
    where: { idArchivo },
    include: { entrega: { select: { tarea: { select: { idGrupo: true } } } }, contenido: true },
  });
  if (!archivo || !archivo.contenido) throw new ErrorDeNegocio("Archivo no disponible");
  await requerirIntegranteActivo(idUsuario, archivo.entrega.tarea.idGrupo);
  return { nombre: archivo.nombre, mime: archivo.mime, datos: archivo.contenido.datos };
}
