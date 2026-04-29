// robots.ts — Next.js App Router Metadata Files API.
// Se sirve en /robots.txt.
//
// Política:
//   - Indexamos: home, matches, torneos públicos, /legal/*, /ayuda/*,
//     y todas las rutas editoriales del grupo (public) (Lote 8).
//   - No indexamos: áreas privadas, auth, API, uploads, admin.

import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/matches",
          "/torneo/",
          "/live-match",
          "/legal/",
          "/ayuda/",
          // Lote 8 — rutas editoriales públicas
          "/blog",
          "/blog/",
          "/casas",
          "/casas/",
          "/guias",
          "/guias/",
          "/pronosticos",
          "/pronosticos/",
          "/partidos/",
          "/cuotas",
          "/comunidad",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/perfil",
          "/mis-combinadas",
          "/api/",
          "/auth/",
          "/uploads/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
