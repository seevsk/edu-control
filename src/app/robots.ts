import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** Solo la página de inicio de sesión es pública; todo lo demás es privado de cada usuario. */
export default function robots(): MetadataRoute.Robots {
  return {
    // El logo de los correos se permite para que los proxys de imágenes de Gmail y Outlook lo puedan leer.
    rules: { userAgent: "*", allow: ["/login", "/correo-logo.png"], disallow: ["/"] },
    sitemap: new URL("/sitemap.xml", env.APP_URL).toString(),
  };
}
