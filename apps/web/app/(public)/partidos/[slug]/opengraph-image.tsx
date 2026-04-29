// OG dinámico para /partidos/[slug] — Lote 8.

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/content/og-template";
import * as partidos from "@/lib/content/partidos";

export const runtime = "nodejs";
export const alt = "Previa de partido — Habla!";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage({
  params,
}: {
  params: { slug: string };
}) {
  const doc = partidos.getBySlug(params.slug);
  const title = doc?.frontmatter.title ?? "Previa de partido";
  const subtitulo = doc?.frontmatter.author ?? "Habla! Editorial";
  return renderOgImage({
    title,
    categoria: "Partido",
    subtitulo,
  });
}
