// OG dinámico para /guias/[slug] — Lote 8.

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/content/og-template";
import * as guias from "@/lib/content/guias";

export const runtime = "nodejs";
export const alt = "Guía de Habla!";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage({
  params,
}: {
  params: { slug: string };
}) {
  const doc = guias.getBySlug(params.slug);
  const title = doc?.frontmatter.title ?? "Guía Habla!";
  const subtitulo = doc?.frontmatter.author ?? "Habla! Editorial";
  return renderOgImage({
    title,
    categoria: "Guía",
    subtitulo,
  });
}
