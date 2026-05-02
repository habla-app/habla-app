// Root layout. Fuentes (Barlow Condensed + DM Sans) via next/font. ToastProvider
// global para toasts disponibles en cualquier ruta. El resto del chrome (NavBar,
// BottomNav) vive en los layouts hijos ((main), auth, admin).
import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import { SessionProviderClient } from "@/components/auth/SessionProviderClient";
import { CookieBanner } from "@/components/CookieBanner";
import { WebVitalsCollector } from "@/components/WebVitalsCollector";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
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
    default: "Habla! · Todas las fijas en una",
  },
  description:
    "Picks de valor con razonamiento, comparador de cuotas y Liga gratuita con S/ 1,250 mensuales en premios. Disponible como PWA en tu celular.",
  applicationName: "Habla! Picks",
  keywords: [
    "picks fútbol perú",
    "pronósticos deportivos",
    "comparador cuotas",
    "liga 1",
    "mundial 2026",
    "habla picks",
  ],
  authors: [{ name: "Habla! Team" }],
  // `manifest` apunta al endpoint dinámico que sirve `app/manifest.ts`
  // como /manifest.webmanifest. Next.js inyecta el <link rel="manifest">
  // automáticamente cuando existe el archivo, pero declararlo aquí
  // hace explícito el contrato (importante para PWA installable).
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Habla!",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Habla!",
    locale: "es_PE",
    url: SITE_URL,
    title: "Habla! · Todas las fijas en una",
    description:
      "Picks de valor con razonamiento, comparador de cuotas y Liga gratuita con S/ 1,250 mensuales en premios.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Habla! · Todas las fijas en una",
    description:
      "Picks de valor con razonamiento, comparador de cuotas y Liga gratuita con S/ 1,250 mensuales en premios.",
  },
  // `icons` lo autogenera Next a partir de app/icon*.tsx + app/apple-icon.tsx.
  // No hace falta listarlos acá — evita duplicar el <link>.
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lote I v3.1: removemos `maximumScale: 1` para no bloquear pinch-zoom
  // accesible — usuarios con baja visión necesitan poder hacer zoom.
  // El layout mobile-first del Lote B ya maneja sin overflow horizontal,
  // así que desbloquear el zoom no rompe nada.
  themeColor: "#001050",
  viewportFit: "cover",
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
          <ToastProvider>{children}</ToastProvider>
          <CookieBanner />
          <WebVitalsCollector />
          <ServiceWorkerRegistrar />
        </SessionProviderClient>
      </body>
    </html>
  );
}
