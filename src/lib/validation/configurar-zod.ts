import { z } from "zod";

// Mensajes por defecto de Zod en español: ningún error técnico en inglés llega a la interfaz.
z.config(z.locales.es());
