// OG dinámico para /las-fijas/[slug] — Lote 8 + Lote M v3.2.
//
// El slug ahora deriva del partido real (no de MDX), así que resolvemos
// vía `resolverFijaPorSlug` y caemos en un OG genérico si no matchea.

import {
  renderOgImage,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/content/og-template";
import { resolverFijaPorSlug } from "@/lib/services/las-fijas.service";

export const runtime = "nodejs";
export const alt = "Las Fijas — Habla!";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage({
  params,
}: {
  params: { slug: string };
}) {
  const r = await resolverFijaPorSlug(params.slug);
  const title =
    r.estado === "found" && r.partido
      ? `${r.partido.equipoLocal} vs ${r.partido.equipoVisita}`
      : "Las Fijas";
  const subtitulo =
    r.estado === "found" && r.partido ? r.partido.liga : "Habla! Editorial";
  return renderOgImage({
    title,
    categoria: "Las Fijas",
    subtitulo,
  });
}
