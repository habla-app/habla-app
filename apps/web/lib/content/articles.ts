// Loader de artículos de blog — Lote 8.
//
// Lee `apps/web/content/blog/*.mdx` + `_meta.ts`. El `_meta.ts` define la
// lista ordenada (por publishedAt DESC) — los listings paginados consumen
// esa lista sin tocar fs en cada request. Los .mdx individuales se cargan
// on-demand y se cachean in-process.

import { articleFrontmatterSchema } from "./schema";
import {
  contentDir,
  loadMdx,
} from "./loader";
import type { ArticleFrontmatter, LoadedDoc } from "./types";
import { BLOG_META, type ArticleMetaEntry } from "@/content/blog/_meta";

const SOURCE = "content:articles";
const DIR = () => contentDir("blog");

const cache = new Map<string, LoadedDoc<ArticleFrontmatter> | null>();

function load(slug: string): LoadedDoc<ArticleFrontmatter> | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  const doc = loadMdx(
    DIR(),
    `${slug}.mdx`,
    articleFrontmatterSchema,
    SOURCE,
  );
  cache.set(slug, doc);
  return doc;
}

/**
 * Devuelve la lista plana de artículos válidos (frontmatter ok), ordenada
 * por publishedAt DESC. Lee todos los .mdx referenciados por `_meta.ts`.
 * Si un slug del meta apunta a un .mdx con frontmatter roto, se omite.
 */
export function getAll(): Array<LoadedDoc<ArticleFrontmatter>> {
  const docs: Array<LoadedDoc<ArticleFrontmatter>> = [];
  for (const entry of BLOG_META) {
    const doc = load(entry.slug);
    if (doc) docs.push(doc);
  }
  // El _meta.ts ya viene ordenado, pero re-ordenamos defensivo.
  docs.sort(
    (a, b) =>
      Date.parse(b.frontmatter.publishedAt) -
      Date.parse(a.frontmatter.publishedAt),
  );
  return docs;
}

export function getBySlug(
  slug: string,
): LoadedDoc<ArticleFrontmatter> | null {
  return load(slug);
}

/**
 * Devuelve hasta `n` artículos relacionados a `slug` matcheando por tags.
 * Si no hay suficientes con tags compartidos, completa con los últimos
 * publicados (excluyendo `slug`).
 */
export function getRelated(
  slug: string,
  n = 3,
): Array<LoadedDoc<ArticleFrontmatter>> {
  const all = getAll();
  const target = all.find((d) => d.frontmatter.slug === slug);
  if (!target) return all.filter((d) => d.frontmatter.slug !== slug).slice(0, n);

  const targetTags = new Set(target.frontmatter.tags);
  const conPuntaje = all
    .filter((d) => d.frontmatter.slug !== slug)
    .map((d) => {
      const overlap = d.frontmatter.tags.filter((t) => targetTags.has(t)).length;
      return { doc: d, overlap };
    });

  conPuntaje.sort((a, b) => {
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    return (
      Date.parse(b.doc.frontmatter.publishedAt) -
      Date.parse(a.doc.frontmatter.publishedAt)
    );
  });

  return conPuntaje.slice(0, n).map((c) => c.doc);
}

export function getByCategory(
  cat: string,
): Array<LoadedDoc<ArticleFrontmatter>> {
  return getAll().filter((d) => d.frontmatter.categoria === cat);
}

export function getByTag(tag: string): Array<LoadedDoc<ArticleFrontmatter>> {
  return getAll().filter((d) => d.frontmatter.tags.includes(tag));
}

/** Lista de entries del _meta — útil para listings que no necesitan body. */
export function getMetaEntries(): readonly ArticleMetaEntry[] {
  return BLOG_META;
}
