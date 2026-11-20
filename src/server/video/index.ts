import { env } from "@/lib/env";
import { LiveKitProveedor } from "./livekit-proveedor";
import type { ProveedorVideo } from "./proveedor-video";
import { SimuladoProveedor } from "./simulado-proveedor";

export const proveedorVideo: ProveedorVideo =
  env.VIDEO_PROVIDER === "livekit" ? new LiveKitProveedor() : new SimuladoProveedor();
export type { CredencialesSala, ProveedorVideo } from "./proveedor-video";
