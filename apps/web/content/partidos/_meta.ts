// Índice de previas de partidos editoriales — Lote 8.
//
// Cada entry apunta a un .mdx en `apps/web/content/partidos/<slug>.mdx`.
// El frontmatter `partidoId` (opcional) cruza con la tabla `Partido` para
// que `getProximos()` filtre los que ya pasaron.

export interface PartidoMetaEntry {
  slug: string;
  publishedAt: string; // yyyy-mm-dd
}

export const PARTIDOS_META: readonly PartidoMetaEntry[] = [
  // Vacío en este lote. Las previas se producen en Lote 14.
] as const;
