import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** Solo la página de inicio de sesión es pública; todo lo demás es privado de cada usuario. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/login"], disallow: ["/"] },
    sitemap: new URL("/sitemap.xml", env.APP_URL).toString(),
  };
}
