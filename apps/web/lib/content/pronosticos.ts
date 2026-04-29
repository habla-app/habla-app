// Loader de pronósticos por liga — Lote 8.
//
// Cada .mdx representa un compilado de pronósticos editoriales para una
// liga (Liga 1 Perú, Mundial 2026, Champions, etc.). El slug del archivo
// es el slug de la liga; el frontmatter `liga` debe matchear el filename
// (validamos en el loader).

import { pronosticoFrontmatterSchema } from "./schema";
import { contentDir, loadMdx } from "./loader";
import type { PronosticoFrontmatter, LoadedDoc } from "./types";
import {
  PRONOSTICOS_META,
  type PronosticoMetaEntry,
} from "@/content/pronosticos/_meta";

const SOURCE = "content:pronosticos";
const DIR = () => contentDir("pronosticos");

const cache = new Map<string, LoadedDoc<PronosticoFrontmatter> | null>();

function load(liga: string): LoadedDoc<PronosticoFrontmatter> | null {
  if (cache.has(liga)) return cache.get(liga) ?? null;
  const doc = loadMdx(
    DIR(),
    `${liga}.mdx`,
    pronosticoFrontmatterSchema,
    SOURCE,
  );
  cache.set(liga, doc);
  return doc;
}

export function getByLiga(
  liga: string,
): LoadedDoc<PronosticoFrontmatter> | null {
  return load(liga);
}

export function getAll(): Array<LoadedDoc<PronosticoFrontmatter>> {
  const docs: Array<LoadedDoc<PronosticoFrontmatter>> = [];
  for (const entry of PRONOSTICOS_META) {
    const doc = load(entry.liga);
    if (doc) docs.push(doc);
  }
  return docs;
}

export function getMetaEntries(): readonly PronosticoMetaEntry[] {
  return PRONOSTICOS_META;
}
