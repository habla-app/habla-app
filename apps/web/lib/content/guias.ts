// Loader de guías editoriales — Lote 8.
//
// Patrón idéntico a articles.ts. Las guías son contenido evergreen
// ("Cómo armar tu primera combinada", "Glosario de apuestas", etc.) y
// soportan un campo `tipo: "howto"` opcional en el frontmatter para que
// la page emita un schema.org/HowTo además del Article.

import { guiaFrontmatterSchema } from "./schema";
import { contentDir, loadMdx } from "./loader";
import type { GuiaFrontmatter, LoadedDoc } from "./types";
import { GUIAS_META, type GuiaMetaEntry } from "@/content/guias/_meta";

const SOURCE = "content:guias";
const DIR = () => contentDir("guias");

const cache = new Map<string, LoadedDoc<GuiaFrontmatter> | null>();

function load(slug: string): LoadedDoc<GuiaFrontmatter> | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  const doc = loadMdx(DIR(), `${slug}.mdx`, guiaFrontmatterSchema, SOURCE);
  cache.set(slug, doc);
  return doc;
}

export function getAll(): Array<LoadedDoc<GuiaFrontmatter>> {
  const docs: Array<LoadedDoc<GuiaFrontmatter>> = [];
  for (const entry of GUIAS_META) {
    const doc = load(entry.slug);
    if (doc) docs.push(doc);
  }
  docs.sort(
    (a, b) =>
      Date.parse(b.frontmatter.publishedAt) -
      Date.parse(a.frontmatter.publishedAt),
  );
  return docs;
}

export function getBySlug(slug: string): LoadedDoc<GuiaFrontmatter> | null {
  return load(slug);
}

export function getMetaEntries(): readonly GuiaMetaEntry[] {
  return GUIAS_META;
}
