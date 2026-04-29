// Loader de reviews de casas — Lote 8.
//
// Combina dos fuentes:
//   - el .mdx editorial en `apps/web/content/casas/<slug>.mdx`,
//   - la fila correspondiente en la tabla `Afiliado` (Lote 7).
//
// El cruce se hace por `frontmatter.afiliadoSlug`. `getActivas()` devuelve
// SOLO reviews cuyo afiliado está activo Y autorizado por MINCETUR. Una
// review puede existir como .mdx pero no aparecer en `getActivas()` si la
// regulación cambió y desactivamos el afiliado — la review sigue siendo
// accesible por slug directo (para preservar URLs indexadas), pero el
// listing público la oculta.

import { casaFrontmatterSchema } from "./schema";
import { contentDir, loadMdx } from "./loader";
import type { CasaFrontmatter, LoadedDoc } from "./types";
import { CASAS_META, type CasaMetaEntry } from "@/content/casas/_meta";
import {
  obtenerAfiliadoPorSlug,
  obtenerActivosOrdenados,
  type AfiliadoVista,
} from "@/lib/services/afiliacion.service";

const SOURCE = "content:casas";
const DIR = () => contentDir("casas");

const cache = new Map<string, LoadedDoc<CasaFrontmatter> | null>();

function load(slug: string): LoadedDoc<CasaFrontmatter> | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  const doc = loadMdx(DIR(), `${slug}.mdx`, casaFrontmatterSchema, SOURCE);
  cache.set(slug, doc);
  return doc;
}

export interface CasaReviewVista {
  doc: LoadedDoc<CasaFrontmatter>;
  afiliado: AfiliadoVista | null;
}

/**
 * Devuelve todas las reviews que tienen .mdx válido. El campo `afiliado`
 * puede ser null si el afiliadoSlug del frontmatter no matchea con BD —
 * esa review NO aparecerá en `getActivas()` pero sigue accesible por slug.
 */
export async function getAll(): Promise<CasaReviewVista[]> {
  const docs: LoadedDoc<CasaFrontmatter>[] = [];
  for (const entry of CASAS_META) {
    const doc = load(entry.slug);
    if (doc) docs.push(doc);
  }
  const conAfiliado = await Promise.all(
    docs.map(async (doc) => {
      const afiliado = await obtenerAfiliadoPorSlug(
        doc.frontmatter.afiliadoSlug,
      );
      return { doc, afiliado };
    }),
  );
  return conAfiliado;
}

export async function getBySlug(slug: string): Promise<CasaReviewVista | null> {
  const doc = load(slug);
  if (!doc) return null;
  const afiliado = await obtenerAfiliadoPorSlug(doc.frontmatter.afiliadoSlug);
  return { doc, afiliado };
}

/**
 * Lista de reviews CON afiliado activo Y autorizado por MINCETUR. Para
 * el listing público `/casas`. La intersección "tengo .mdx" + "afiliado
 * está activo" garantiza que sólo mostremos casas en línea.
 */
export async function getActivas(): Promise<CasaReviewVista[]> {
  const activos = await obtenerActivosOrdenados();
  const activosBySlug = new Map(activos.map((a) => [a.slug, a]));

  const reviews: CasaReviewVista[] = [];
  for (const entry of CASAS_META) {
    const doc = load(entry.slug);
    if (!doc) continue;
    const afiliado = activosBySlug.get(doc.frontmatter.afiliadoSlug) ?? null;
    if (!afiliado) continue;
    reviews.push({ doc, afiliado });
  }
  // Orden: el de `obtenerActivosOrdenados` (ordenDestacado ASC, rating DESC).
  reviews.sort((a, b) => {
    const ordA = a.afiliado!.ordenDestacado;
    const ordB = b.afiliado!.ordenDestacado;
    if (ordA !== ordB) return ordA - ordB;
    return (b.afiliado!.rating ?? 0) - (a.afiliado!.rating ?? 0);
  });
  return reviews;
}

export function getMetaEntries(): readonly CasaMetaEntry[] {
  return CASAS_META;
}
