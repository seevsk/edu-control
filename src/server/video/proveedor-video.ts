export type CredencialesSala =
  | { tipo: "livekit"; serverUrl: string; token: string }
  | { tipo: "simulado" };

export interface ProveedorVideo {
  /** Prepara la sala. Devuelve el identificador que se guarda en `reunion.sala_url`. */
  crearSala(datos: { nombre: string; abre: Date; cierra: Date }): Promise<string>;
  credencialesDeEntrada(datos: {
    sala: string;
    idUsuario: number;
    nombre: string;
    moderador: boolean;
    abre: Date;
    cierra: Date;
  }): Promise<CredencialesSala>;
  /** Saca a todos y cierra la sala ya. No falla si no existe. */
  cerrarSala(sala: string): Promise<void>;
  /** Igual que cerrarSala (reunion cancelada). */
  borrarSala(sala: string): Promise<void>;
  /**
   * Cuantas personas estan conectadas ahora a la sala (0 si la sala ya no existe). `null` si el
   * proveedor no puede saberlo: quien llama no debe decidir nada a partir de un `null`.
   */
  participantesConectados(sala: string): Promise<number | null>;
}
