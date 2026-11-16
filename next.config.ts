import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Solo en desarrollo: permite abrir la app por 127.0.0.1 (otra sesión, para revisar móvil y tablet sin tocar la de localhost).
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
