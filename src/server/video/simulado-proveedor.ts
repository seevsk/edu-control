import type { CredencialesSala, ProveedorVideo } from "./proveedor-video";

/** Desarrollo sin clave: no llama a ningun servicio. */
export class SimuladoProveedor implements ProveedorVideo {
  async crearSala(datos: { nombre: string }): Promise<string> {
    return datos.nombre;
  }

  async credencialesDeEntrada(): Promise<CredencialesSala> {
    return { tipo: "simulado" };
  }

  async cerrarSala(sala: string): Promise<void> {
    console.log(`[video] (simulado) sala cerrada: ${sala}`);
  }

  async borrarSala(sala: string): Promise<void> {
    console.log(`[video] (simulado) sala borrada: ${sala}`);
  }
}
