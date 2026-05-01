// robots.ts — Next.js App Router Metadata Files API.
// Se sirve en /robots.txt.
//
// Política (Lote J — v3.1):
//   - Indexamos: home, /cuotas, /partidos/*, /live-match (público),
//     /legal/*, /ayuda/*, /premium, y todas las rutas editoriales del
//     grupo (public).
//   - No indexamos: áreas privadas (/perfil, /mis-predicciones,
//     /comunidad/torneo/[slug], /comunidad/mes/[mes]), legacy
//     /torneo/[id] (redirige 301 a privado), auth, API, uploads, admin.
//
// Nota: el path `/comunidad/[username]` (perfil público de un tipster)
// queda accesible para Google sin entrada explícita en allow porque
// `/comunidad` ya cubre el prefijo. La ruta `/comunidad/torneo/` queda
// excluida por estar en disallow (más específica gana en interpretación
// permisiva, pero por seguridad la dejamos explícita).

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
          "/mis-predicciones",
          "/mis-combinadas",
          "/comunidad/torneo/",
          "/comunidad/mes/",
          // Legacy del Lote 0 — redirige 301 a /comunidad/torneo/[slug]
          // (privada). No indexar la URL antigua.
          "/torneo/",
          // Premium privadas (post-suscripción)
          "/premium/checkout",
          "/premium/exito",
          "/premium/mi-suscripcion",
          "/api/",
          "/auth/",
          "/uploads/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
