import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: new URL("/login", env.APP_URL).toString(), changeFrequency: "monthly", priority: 1 }];
}
