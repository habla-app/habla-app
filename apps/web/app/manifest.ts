// PWA manifest — Next.js App Router Metadata Files API. Se sirve en
// /manifest.webmanifest e indica al browser cómo instalar la PWA. Lote I
// v3.1 (1 may 2026): refresh de copy y branding al modelo Habla! Picks
// (Premium WhatsApp Channel). Reemplaza el copy legacy del Lote 0
// ("Lukas", "torneos") que quedó obsoleto tras el pivot v3.1.
//
// Iconos: rutas dinámicas Next.js Metadata Files (`app/icon.tsx`,
// `app/icon1.tsx`, `app/icon2.tsx`) que generan PNG en runtime via
// ImageResponse. No usamos PNGs estáticos en /public/icons/ porque:
//  - Garantizamos consistencia visual con el resto del branding.
//  - El edge runtime sirve los assets con cache long-term automático.
//  - Cero dependencias de tooling de imágenes.
// Brand puede entregar PNGs finales más adelante; reemplazo es trivial.
//
// Maskable purpose: el contenido de los iconos (letra "H!" centrada en
// fondo azul completo, sin esquinas redondeadas en el SVG) respeta la
// "safe zone" (40% radius desde el centro), lo que permite que el OS
// recorte el icono a su shape de máscara (círculo en Android,
// squircle en iOS) sin perder lo importante.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Habla! Picks",
    short_name: "Habla!",
    description:
      "Picks de valor con razonamiento. Liga gratuita con S/1,250 mensuales.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Background al cargar splash screen — tono claro de la app (token
    // --bg-page) para evitar flash oscuro al instalar.
    background_color: "#F5F7FC",
    // Tema azul oscuro de la marca — pinta la status bar del browser
    // y el chrome de la PWA instalada. Coincide con viewport.themeColor
    // del root layout.
    theme_color: "#001050",
    orientation: "portrait",
    lang: "es-PE",
    dir: "ltr",
    categories: ["sports", "entertainment", "lifestyle"],
    // W3C permite `purpose: "any maskable"` en una sola entrada, pero
    // los types de Next.js (MetadataRoute.Manifest) son más estrictos y
    // sólo aceptan un valor del enum a la vez. Para cubrir ambos
    // contextos sin perder type-safety: declaramos cada size dos veces,
    // una con "any" (fallback en browsers sin soporte maskable) y otra
    // con "maskable" (Android adaptive icons + Chrome PWA install).
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon1",
        sizes: "384x384",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon1",
        sizes: "384x384",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon2",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon2",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      // Apple touch icon para iOS — fuera del set maskable porque iOS
      // ignora purpose y aplica su propio rounded corner mask.
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
