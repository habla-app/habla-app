// Sitemap dinámico — Next.js App Router Metadata Files API.
//
// Lote 2 — SEO. Se sirve en /sitemap.xml.
//
// Incluye:
//  - Páginas estáticas públicas (home, matches, tienda, /live-match,
//    /ayuda/faq).
//  - Rutas /legal/* (Lote 3): terminos, privacidad, cookies,
//    juego-responsable, canjes, aviso. `lastModified` apunta a la fecha
//    de vigencia del documento (2026-04-24).
//  - Torneos públicos (ABIERTO o EN_VIVO) con `lastModified` del torneo.
//
// Excluye rutas privadas (/wallet, /perfil, /mis-combinadas, /admin, /auth)
// y endpoints API — esos van en robots.ts como Disallow.

import type { MetadataRoute } from "next";
import { prisma } from "@habla/db";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1h — Google no necesita más fresh.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const estaticas: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/matches`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/live-match`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/tienda`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/ayuda/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
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

  // Torneos públicos — ABIERTO o EN_VIVO. Limitamos a 1000 para no explotar
  // el XML; el caso real tendrá decenas, no miles.
  let torneos: MetadataRoute.Sitemap = [];
  try {
    // El schema de Torneo no tiene `updatedAt`; usamos `creadoEn` como
    // proxy razonable — los torneos se actualizan cambiando el estado y
    // pozoBruto, pero cambios internos no son materiales para Google. El
    // poller activo marca `hourly` como changeFrequency para que Google
    // re-crawlee cuando corresponda.
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
    // Si la BD está caída, devolvemos solo las estáticas — mejor un sitemap
    // parcial que fallar el render entero.
  }

  return [...estaticas, ...legales, ...torneos];
}
