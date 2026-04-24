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

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s | Habla!",
    default: "Habla! — Predice, compite, gana",
  },
  description:
    "Torneos de predicciones de fútbol en Perú. Armá tu combinada, competí en vivo y canjeá tus Lukas por premios reales.",
  applicationName: "Habla!",
  keywords: [
    "predicciones fútbol",
    "torneos perú",
    "pronósticos deportivos",
    "liga 1",
    "mundial 2026",
  ],
  authors: [{ name: "Habla! Team" }],
  openGraph: {
    type: "website",
    siteName: "Habla!",
    locale: "es_PE",
    url: SITE_URL,
    title: "Habla! — Predice, compite, gana",
    description:
      "Torneos de predicciones de fútbol en Perú. Armá tu combinada, competí en vivo y canjeá tus Lukas por premios reales.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Habla! — Predice, compite, gana",
    description:
      "Torneos de predicciones de fútbol en Perú. Competí, ganá Lukas, canjealos por premios reales.",
  },
  // `icons` lo autogenera Next a partir de app/icon.tsx + app/apple-icon.tsx.
  // No hace falta listarlos acá — evita duplicar el <link>.
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
