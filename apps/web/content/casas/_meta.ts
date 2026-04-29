// Índice editorial de reviews de casas — Lote 8.
//
// Cada entry apunta a un .mdx en `apps/web/content/casas/<slug>.mdx`.
// El cruce con la tabla `Afiliado` (Lote 7) se hace en runtime por
// `frontmatter.afiliadoSlug` — el slug del meta y el del frontmatter NO
// tienen que coincidir, aunque por convención usamos el mismo nombre.

export interface CasaMetaEntry {
  slug: string;
  publishedAt: string; // yyyy-mm-dd
}

export const CASAS_META: readonly CasaMetaEntry[] = [
  { slug: "dummy", publishedAt: "2026-05-08" },
] as const;
