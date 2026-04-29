// Índice editorial de guías — Lote 8.

export interface GuiaMetaEntry {
  slug: string;
  publishedAt: string; // yyyy-mm-dd
}

export const GUIAS_META: readonly GuiaMetaEntry[] = [
  { slug: "dummy", publishedAt: "2026-05-08" },
] as const;
