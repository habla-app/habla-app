// robots.ts — Next.js App Router Metadata Files API.
// Se sirve en /robots.txt.
//
// Política:
//   - Indexamos: home, matches, torneos públicos, legales.
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
