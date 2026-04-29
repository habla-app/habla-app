// OG dinámico para /casas/[slug] — Lote 8.

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/content/og-template";
import * as casas from "@/lib/content/casas";

export const runtime = "nodejs";
export const alt = "Review de casa MINCETUR — Habla!";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage({
  params,
}: {
  params: { slug: string };
}) {
  const review = await casas.getBySlug(params.slug);
  const title = review?.doc.frontmatter.title ?? "Casa autorizada MINCETUR";
  const subtitulo = review?.afiliado?.nombre
    ? `Review · ${review.afiliado.nombre}`
    : "Habla! Editorial";
  return renderOgImage({
    title,
    categoria: "Casas",
    subtitulo,
  });
}
