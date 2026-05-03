// Sitemap dinámico — Next.js App Router Metadata Files API.
//
// Lote K v3.2 (May 2026): rebrand de URLs públicas. URLs viejas
// (/cuotas, /partidos/, /casas/, /guias/, /comunidad, /premium,
// /suscribir) se retiran del sitemap y existen solo como redirects 301
// (next.config.js). El sitemap usa exclusivamente URLs nuevas v3.2.
//
// Lote U v3.2 (May 2026): revisado. Confirmado que solo URLs nuevas
// aparecen — las viejas están cubiertas por los redirects 301 del Lote K.
//
// URLs públicas indexables (Lote K v3.2):
//   /                                  Home
//   /las-fijas                         (lista — fusión de /cuotas + /partidos)
//   /las-fijas/[slug]                  (detalle por partido editorial)
//   /reviews-y-guias                   (hub Reviews + Guías)
//   /reviews-y-guias/casas             (lista casas autorizadas)
//   /reviews-y-guias/casas/[slug]      (review individual)
//   /reviews-y-guias/guias             (lista guías editoriales)
//   /reviews-y-guias/guias/[slug]      (guía individual)
//   /pronosticos                       (lista pronósticos)
//   /pronosticos/[liga]                (pronósticos por liga)
//   /blog, /blog/[slug]                (blog editorial)
//   /liga                              (Liga Habla! listing público)
//   /socios                            (página de venta Socios)
//   /live-match                        (pública — live-match general)
//   /ayuda/faq, /legal/*               (estáticas)
//
// Excluye rutas privadas (/perfil, /mis-predicciones, /admin, /auth,
// /liga/[slug], /liga/mes/, /jugador/[username], /socios-hub,
// /socios/checkout, /socios/exito) y endpoints API — esos van en
// robots.ts como Disallow.

import type { MetadataRoute } from "next";
import * as articles from "@/lib/content/articles";
import * as casas from "@/lib/content/casas";
import * as guias from "@/lib/content/guias";
import * as pronosticos from "@/lib/content/pronosticos";
import * as partidos from "@/lib/content/partidos";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1h — Google no necesita más fresh.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const estaticas: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/las-fijas`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/live-match`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE_URL}/ayuda/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/reviews-y-guias`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/reviews-y-guias/casas`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/reviews-y-guias/guias`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/pronosticos`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/liga`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/socios`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  // Fecha de vigencia v1.0 de los documentos legales (24 abr 2026).
  // Cuando se publique una nueva versión, actualizar este valor.
  const legalLastMod = new Date("2026-04-24T00:00:00.000Z");
  const legales: MetadataRoute.Sitemap = [
    "terminos",
    "privacidad",
    "cookies",
    "juego-responsable",
    "canjes",
    "aviso",
  ].map((slug) => ({
    url: `${BASE_URL}/legal/${slug}`,
    lastModified: legalLastMod,
    changeFrequency: "weekly" as const,
    priority: 0.3,
  }));

  // Lote 8 — slugs editoriales (lectura sincrónica de loaders, sin BD).
  const blogEntries: MetadataRoute.Sitemap = articles.getAll().map((d) => ({
    url: `${BASE_URL}/blog/${d.frontmatter.slug}`,
    lastModified: new Date(d.frontmatter.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  const guiasEntries: MetadataRoute.Sitemap = guias.getAll().map((d) => ({
    url: `${BASE_URL}/reviews-y-guias/guias/${d.frontmatter.slug}`,
    lastModified: new Date(d.frontmatter.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  const pronosticosEntries: MetadataRoute.Sitemap = pronosticos
    .getMetaEntries()
    .map((e) => {
      const doc = pronosticos.getByLiga(e.liga);
      const lastMod = doc
        ? new Date(doc.frontmatter.updatedAt)
        : new Date(e.publishedAt);
      return {
        url: `${BASE_URL}/pronosticos/${e.liga}`,
        lastModified: lastMod,
        changeFrequency: "daily" as const,
        priority: 0.7,
      };
    });
  const partidosEntries: MetadataRoute.Sitemap = partidos
    .getMetaEntries()
    .map((e) => {
      const doc = partidos.getBySlug(e.slug);
      const lastMod = doc
        ? new Date(doc.frontmatter.updatedAt)
        : new Date(e.publishedAt);
      return {
        url: `${BASE_URL}/las-fijas/${e.slug}`,
        lastModified: lastMod,
        changeFrequency: "daily" as const,
        priority: 0.7,
      };
    });

  // Casas: getAll incluye reviews aunque el afiliado esté inactivo (la
  // URL sigue siendo accesible). El listing público sólo muestra activas
  // pero al sitemap le sumamos todas las que tienen .mdx para no perder
  // SEO de URLs ya indexadas.
  let casasEntries: MetadataRoute.Sitemap = [];
  try {
    const reviews = await casas.getAll();
    casasEntries = reviews.map((r) => ({
      url: `${BASE_URL}/reviews-y-guias/casas/${r.doc.frontmatter.slug}`,
      lastModified: new Date(r.doc.frontmatter.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {
    // Si la BD se cae, dejamos las casas afuera del sitemap. Las pages
    // siguen accesibles individualmente.
  }

  return [
    ...estaticas,
    ...legales,
    ...blogEntries,
    ...casasEntries,
    ...guiasEntries,
    ...pronosticosEntries,
    ...partidosEntries,
  ];
}
