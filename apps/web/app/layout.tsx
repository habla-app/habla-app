import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Habla! - Torneos de Predicciones",
  description:
    "Predice resultados de futbol, compite en torneos y gana premios reales. La plataforma #1 de predicciones deportivas en Peru.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
