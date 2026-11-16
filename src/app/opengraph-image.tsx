import { ImageResponse } from "next/og";

export const alt = "EduControl: tareas, horarios y avance de tu grupo en un solo lugar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen al compartir un enlace de EduControl (WhatsApp, Slack, redes). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#fafafa", color: "#18181b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7.5" fill="#18181b" />
            <path d="M24.6 16a8.6 8.6 0 1 0-2.1 5.65" fill="none" stroke="#ffffff" strokeWidth="4.8" />
            <rect x="9.4" y="13.9" width="15.2" height="4.2" rx="0.6" fill="#ffffff" />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>EduControl</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 112, fontWeight: 600, letterSpacing: -5, lineHeight: 1 }}>Tu grupo, al día.</span>
          <span style={{ fontSize: 36, color: "#52525b", maxWidth: 900, lineHeight: 1.35 }}>
            Reparte las tareas, mira quién avanzó y encuentra cuándo reunirse.
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {["rgba(22,163,74,0.55)", "rgba(22,163,74,0.55)", "rgba(22,163,74,0.16)", "#e4e4e7", "rgba(22,163,74,0.55)", "rgba(22,163,74,0.55)", "rgba(22,163,74,0.16)"].map((color, indice) => (
            <div key={indice} style={{ width: 120, height: 16, borderRadius: 4, background: color }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
