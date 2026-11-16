import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const DESCRIPCION =
  "Reparte las tareas del grupo, mira con datos quién avanzó y encuentra cuándo reunirse. Cursos, evaluaciones y calendario en un solo lugar.";

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  // Cada página define su título; la pestaña muestra "Cursos · EduControl".
  title: { default: "EduControl · Tu grupo, al día", template: "%s · EduControl" },
  description: DESCRIPCION,
  applicationName: "EduControl",
  keywords: ["trabajos grupales", "gestión de tareas", "estudiantes", "universidad", "calendario académico", "disponibilidad", "evaluaciones", "Perú"],
  authors: [{ name: "Equipo EduControl" }],
  creator: "Equipo EduControl",
  category: "education",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: "EduControl",
    title: "EduControl · Tu grupo, al día",
    description: DESCRIPCION,
    url: "/login",
  },
  twitter: { card: "summary_large_image", title: "EduControl · Tu grupo, al día", description: DESCRIPCION },
  // El área autenticada es privada: solo /login se indexa (ver src/app/(auth)/login/page.tsx y robots.ts).
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  appleWebApp: { capable: true, title: "EduControl", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-PE" className={cn("h-full", geist.variable, geistMono.variable)} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Empieza en claro (pedido del usuario, 2026-11-16); el usuario puede cambiarlo y se recuerda. */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
