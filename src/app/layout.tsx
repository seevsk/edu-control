import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduControl",
  description: "Cursos, evaluaciones, calendario y trabajos grupales en un solo lugar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
