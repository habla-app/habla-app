// Índice editorial del blog — Lote 8.
//
// Lista ordenada por publishedAt DESC. Mantener actualizado al agregar
// un .mdx nuevo. La razón de no escanear fs en runtime: `_meta.ts` es
// estático y cacheado por Node module loader, evita un readdirSync por
// request en `/blog`.
//
// Para Lote 14 (producción de las 78 piezas): cada PR que agregue un
// .mdx debe agregar también su entrada acá, en la posición correcta
// según fecha de publicación.

export interface ArticleMetaEntry {
  slug: string;
  publishedAt: string; // yyyy-mm-dd
}

export const BLOG_META: readonly ArticleMetaEntry[] = [
  { slug: "dummy", publishedAt: "2026-05-08" },
] as const;
