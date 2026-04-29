// Índice de ligas con pronósticos editoriales — Lote 8.
//
// Cada entry apunta a un .mdx en `apps/web/content/pronosticos/<liga>.mdx`.
// Las ligas se publican vacías por ahora — el contenido se produce en
// Lote 14. Las pages ya pueden listarlas y mostrar los partidos próximos
// que tengan previa MDX.

export interface PronosticoMetaEntry {
  liga: string;
  nombre: string; // texto humano, para listings
  publishedAt: string; // yyyy-mm-dd
}

export const PRONOSTICOS_META: readonly PronosticoMetaEntry[] = [
  { liga: "liga-1-peru", nombre: "Liga 1 Perú", publishedAt: "2026-05-08" },
] as const;
