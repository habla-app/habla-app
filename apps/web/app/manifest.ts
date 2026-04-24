// PWA manifest — Next.js App Router Metadata Files API. Se sirve en
// /manifest.webmanifest. Reemplaza el legacy public/manifest.json, que
// tenía colores desactualizados (naranja del diseño viejo).

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Habla! — Torneos de predicciones deportivas",
    short_name: "Habla!",
    description:
      "Predice fútbol, compite en torneos y canjea Lukas por premios reales.",
    start_url: "/",
    display: "standalone",
    background_color: "#001050",
    theme_color: "#001050",
    orientation: "portrait",
    lang: "es-PE",
    categories: ["sports", "games", "entertainment"],
    // Iconos generados via Next.js Metadata Files API (app/icon.tsx y
    // app/apple-icon.tsx). TODO: reemplazar con PNGs en public/ una vez
    // que brand entregue los assets finales — referenciar a
    // /icon-192.png, /icon-512.png, /apple-touch-icon.png.
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
