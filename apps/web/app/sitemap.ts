// Sitemap dinámico — Next.js App Router Metadata Files API.
//
// Lote 2 — SEO base. Lote 3 — agrega /legal/*. Lote 8 — agrega rutas
// editoriales públicas (/blog, /casas, /guias, /pronosticos, /partidos,
// /cuotas) y leagues de pronósticos.
//
// Se sirve en /sitemap.xml.
//
// Excluye rutas privadas (/perfil, /mis-predicciones, /admin, /auth,
// /comunidad/torneo/[slug], /comunidad/[username]) y endpoints API —
// esos van en robots.ts como Disallow. Lote C v3.1 renombró
// /mis-combinadas → /mis-predicciones (redirect 301 vive en
// next.config.js).

import type { MetadataRoute } from "next";
import { prisma } from "@habla/db";
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
    { url: `${BASE_URL}/cuotas`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/live-match`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE_URL}/ayuda/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    // Lote 8 — rutas listing del grupo (public)
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/casas`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/guias`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/pronosticos`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/comunidad`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/premium`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/suscribir`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
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
    url: `${BASE_URL}/guias/${d.frontmatter.slug}`,
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
        url: `${BASE_URL}/partidos/${e.slug}`,
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
      url: `${BASE_URL}/casas/${r.doc.frontmatter.slug}`,
      lastModified: new Date(r.doc.frontmatter.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {
    // Si la BD se cae, dejamos las casas afuera del sitemap. Las pages
    // siguen accesibles individualmente.
  }

  // Torneos públicos — ABIERTO o EN_VIVO. Limitamos a 1000 para no explotar
  // el XML; el caso real tendrá decenas, no miles.
  let torneos: MetadataRoute.Sitemap = [];
  try {
    const rows = await prisma.torneo.findMany({
      where: { estado: { in: ["ABIERTO", "EN_JUEGO"] } },
      select: { id: true, creadoEn: true },
      take: 1000,
      orderBy: { creadoEn: "desc" },
    });
    torneos = rows.map((t) => ({
      url: `${BASE_URL}/torneo/${t.id}`,
      lastModified: t.creadoEn,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    }));
  } catch {
    // Si la BD está caída, devolvemos solo lo que esté disponible — mejor
    // un sitemap parcial que fallar el render entero.
  }

  return [
    ...estaticas,
    ...legales,
    ...blogEntries,
    ...casasEntries,
    ...guiasEntries,
    ...pronosticosEntries,
    ...partidosEntries,
    ...torneos,
  ];
}
