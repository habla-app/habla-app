// OG dinámico para /blog/[slug] — Lote 8.
//
// Lee el frontmatter del .mdx del slug, arma la imagen via
// `renderOgImage()` (template compartido). Si el slug no existe, cae al
// default (root opengraph-image).

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/content/og-template";
import * as articles from "@/lib/content/articles";

export const runtime = "nodejs";
export const alt = "Artículo de Habla!";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage({
  params,
}: {
  params: { slug: string };
}) {
  const doc = articles.getBySlug(params.slug);
  const title = doc?.frontmatter.title ?? "Habla!";
  const subtitulo = doc?.frontmatter.author ?? "Habla! Editorial";
  return renderOgImage({
    title,
    categoria: "Blog",
    subtitulo,
  });
}
