// Loader de previas de partidos — Lote 8.
//
// Cada .mdx en `content/partidos/<partidoSlug>.mdx` es la previa
// editorial de UN partido. `getProximos()` cruza con la tabla `Partido`
// (Lote 0) para devolver sólo los partidos cuya fecha de inicio está en
// el futuro y que tienen .mdx publicado.
//
// Convención de slug: `equipo1-vs-equipo2-yyyy-mm-dd`.

import { partidoFrontmatterSchema } from "./schema";
import { contentDir, loadMdx } from "./loader";
import type { PartidoFrontmatter, LoadedDoc } from "./types";
import {
  PARTIDOS_META,
  type PartidoMetaEntry,
} from "@/content/partidos/_meta";
import { prisma } from "@habla/db";

const SOURCE = "content:partidos";
const DIR = () => contentDir("partidos");

const cache = new Map<string, LoadedDoc<PartidoFrontmatter> | null>();

function load(slug: string): LoadedDoc<PartidoFrontmatter> | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  const doc = loadMdx(DIR(), `${slug}.mdx`, partidoFrontmatterSchema, SOURCE);
  cache.set(slug, doc);
  return doc;
}

export function getBySlug(slug: string): LoadedDoc<PartidoFrontmatter> | null {
  return load(slug);
}

/**
 * Devuelve hasta `n` previas de partidos próximos (`fechaInicio > now`),
 * cruzando con BD para ordenar por fecha. Sólo incluye partidos con
 * `partidoId` en el frontmatter Y fila viva en `partidos`.
 *
 * Si la BD se cae, devuelve los partidos con .mdx ordenados por
 * `frontmatter.publishedAt` como fallback (best-effort).
 */
export async function getProximos(
  n = 10,
): Promise<
  Array<{
    doc: LoadedDoc<PartidoFrontmatter>;
    partidoId: string;
    fechaInicio: Date | null;
  }>
> {
  const docsConId: Array<{ doc: LoadedDoc<PartidoFrontmatter>; partidoId: string }> = [];
  for (const entry of PARTIDOS_META) {
    const doc = load(entry.slug);
    if (!doc || !doc.frontmatter.partidoId) continue;
    docsConId.push({ doc, partidoId: doc.frontmatter.partidoId });
  }
  if (docsConId.length === 0) return [];

  try {
    const ids = docsConId.map((d) => d.partidoId);
    const partidos = await prisma.partido.findMany({
      where: { id: { in: ids }, fechaInicio: { gt: new Date() } },
      select: { id: true, fechaInicio: true },
      orderBy: { fechaInicio: "asc" },
      take: n,
    });
    const byId = new Map(partidos.map((p) => [p.id, p.fechaInicio]));
    return docsConId
      .filter((d) => byId.has(d.partidoId))
      .map((d) => ({
        doc: d.doc,
        partidoId: d.partidoId,
        fechaInicio: byId.get(d.partidoId) ?? null,
      }))
      .sort((a, b) => {
        const ta = a.fechaInicio?.getTime() ?? 0;
        const tb = b.fechaInicio?.getTime() ?? 0;
        return ta - tb;
      })
      .slice(0, n);
  } catch {
    return docsConId
      .map((d) => ({ doc: d.doc, partidoId: d.partidoId, fechaInicio: null }))
      .slice(0, n);
  }
}

export function getMetaEntries(): readonly PartidoMetaEntry[] {
  return PARTIDOS_META;
}
