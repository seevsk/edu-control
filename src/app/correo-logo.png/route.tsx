import { ImageResponse } from "next/og";

// Imagen fija: se genera en `next build` y se sirve como archivo estático.
export const dynamic = "force-static";

const LADO = 96;

/**
 * Monograma "e" en PNG para los correos (Gmail y Outlook no muestran SVG). Se muestra a 28 px,
 * así que 96 px cubre pantallas de alta densidad. Es pública: el correo se abre sin sesión.
 * El borde claro casi invisible separa el cuadro tinta del fondo en clientes con modo oscuro.
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#18181b",
          borderRadius: 22,
          border: "2px solid rgba(255,255,255,0.14)",
        }}
      >
        <svg width={LADO - 4} height={LADO - 4} viewBox="0 0 32 32">
          <path d="M24.6 16a8.6 8.6 0 1 0-2.1 5.65" fill="none" stroke="#ffffff" strokeWidth="4.8" />
          <rect x="9.4" y="13.9" width="15.2" height="4.2" rx="0.6" fill="#ffffff" />
        </svg>
      </div>
    ),
    { width: LADO, height: LADO },
  );
}
