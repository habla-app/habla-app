// robots.ts — Next.js App Router Metadata Files API.
// Se sirve en /robots.txt.
//
// Lote K v3.2 (May 2026): rebrand de URLs públicas. URLs viejas
// (/cuotas, /partidos/, /casas/, /guias/, /comunidad, /premium,
// /suscribir) ya no existen como pages — son redirects 301 hacia las
// nuevas URLs. No se listan ni en allow ni en disallow porque ya no
// devuelven contenido propio.
//
// Política v3.2:
//   - Indexamos: /, /las-fijas, /las-fijas/[slug], /reviews-y-guias/*,
//     /pronosticos/*, /blog/*, /liga (listing público), /socios (venta),
//     /live-match, /legal/*, /ayuda/*.
//   - No indexamos: rutas privadas (/perfil, /mis-predicciones, /admin,
//     /auth, /liga/[slug] partido detalle, /liga/mes/, /jugador/[username]
//     perfil público requerido login, /socios-hub, /socios/checkout,
//     /socios/exito, /uploads), endpoints API, y la URL legacy /torneo/
//     (redirect 301 a privado).

import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/las-fijas",
          "/las-fijas/",
          "/live-match",
          "/legal/",
          "/ayuda/",
          "/blog",
          "/blog/",
          "/reviews-y-guias",
          "/reviews-y-guias/",
          "/pronosticos",
          "/pronosticos/",
          "/liga",
          "/socios",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/perfil",
          "/mis-predicciones",
          "/mis-combinadas",
          // Privadas v3.2 — Liga (detalle, mes, jugador) requieren login
          "/liga/mes/",
          "/jugador/",
          // Socios Hub + flujo post-compra
          "/socios-hub",
          "/socios/checkout",
          "/socios/exito",
          // Legacy del Lote 0 — redirect 301 a /liga/[partidoId] (privada).
          // No indexar la URL antigua.
          "/torneo/",
          "/api/",
          "/auth/",
          "/uploads/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
