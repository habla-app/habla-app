// Root layout. Fuentes (Barlow Condensed + DM Sans) via next/font. ToastProvider
// global para toasts disponibles en cualquier ruta. El resto del chrome (NavBar,
// BottomNav) vive en los layouts hijos ((main), auth, admin).
import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import { Suspense } from "react";
import { ToastProvider } from "@/components/ui";
import { SessionProviderClient } from "@/components/auth/SessionProviderClient";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import "./globals.css";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-barlow",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Habla! — Torneos de predicciones deportivas",
  description:
    "Predice resultados de fútbol, compite en torneos y canjea premios reales. La plataforma de predicciones deportivas de Perú.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#001050",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${barlow.variable} ${dmSans.variable}`}>
      <body className="font-body antialiased">
        <SessionProviderClient>
          <Suspense fallback={null}>
            <PostHogProvider>
              <ToastProvider>{children}</ToastProvider>
            </PostHogProvider>
          </Suspense>
        </SessionProviderClient>
      </body>
    </html>
  );
}
