import { requerirSesion } from "@/server/auth/session";
import { obtenerUsuarioActual } from "@/server/services/usuario";

export default async function InicioPage() {
  const sesion = await requerirSesion();
  const usuario = await obtenerUsuarioActual(sesion.idUsuario);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">Hola, {usuario.nombre}</h1>
      <p className="mt-1 text-sm text-text-muted">
        Tu cuenta ya esta lista. Cuando registres cursos y crees o te unas a un grupo, tu avance
        y tus proximas fechas van a aparecer aqui.
      </p>
    </div>
  );
}
