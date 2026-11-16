import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícono de inicio en iOS: monograma "e" sobre tinta, con margen para el recorte redondeado. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#18181b" }}>
        <svg width="132" height="132" viewBox="4 4 24 24">
          <path d="M24.6 16a8.6 8.6 0 1 0-2.1 5.65" fill="none" stroke="#ffffff" strokeWidth="4.8" />
          <rect x="9.4" y="13.9" width="15.2" height="4.2" rx="0.6" fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
