// robots.ts — Next.js App Router Metadata Files API.
// Se sirve en /robots.txt.
//
// Política:
//   - Indexamos: home, /cuotas, /partidos/*, torneos públicos, /legal/*,
//     /ayuda/*, /premium, y todas las rutas editoriales del grupo
//     (public) (Lote 8 + Lote B v3.1).
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
          "/cuotas",
          "/partidos/",
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
          "/comunidad",
          // Lote B v3.1 — Premium landing público
          "/premium",
          "/suscribir",
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
