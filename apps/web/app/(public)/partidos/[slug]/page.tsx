// /partidos/[slug] — Lote 8. Previa editorial de un partido.
//
// El render del .mdx incluye `<CuotasComparator partidoId={...} />` como
// placeholder hasta Lote 9. Si no hay .mdx publicado para el slug,
// devolvemos 404 — el slot de partidos en el sitemap solo lista los que
// ya tienen previa.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import * as partidos from "@/lib/content/partidos";
import { MDX_COMPONENTS } from "@/lib/content/mdx-components";
import { TOC } from "@/components/mdx/TOC";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { BackToTop } from "@/components/legal/BackToTop";

interface Params {
  slug: string;
}

export function generateStaticParams(): Array<Params> {
  return partidos.getMetaEntries().map((e) => ({ slug: e.slug }));
}

export function generateMetadata({
  params,
}: {
  params: Params;
}): Metadata {
  const doc = partidos.getBySlug(params.slug);
  if (!doc) return {};
  const { title, excerpt, tags, ogImage, author } = doc.frontmatter;
  return {
    title,
    description: excerpt,
    keywords: tags,
    authors: [{ name: author }],
    alternates: { canonical: `/partidos/${params.slug}` },
    openGraph: {
      type: "article",
      title: `${title} | Habla!`,
      description: excerpt,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default function PartidoPreviaPage({ params }: { params: Params }) {
  const doc = partidos.getBySlug(params.slug);
  if (!doc) notFound();
  const { frontmatter, body, headings } = doc;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14">
      <SportsEventJsonLd doc={doc} />
      <TrackOnMount
        event="articulo_visto"
        props={{
          slug: frontmatter.slug,
          categoria: "partido",
          titulo: frontmatter.title,
          partidoSlug: frontmatter.partidoSlug,
        }}
      />
      <div className="lg:flex lg:gap-10">
        <TOC headings={headings} />
        <article className="min-w-0 flex-1 lg:max-w-[760px]">
          <header className="mb-8">
            <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-brand-blue-main">
              ⚽ Previa de partido
            </p>
            <h1 className="mb-3 font-display text-[36px] font-black leading-tight text-dark md:text-[44px]">
              {frontmatter.title}
            </h1>
            <p className="text-[16px] leading-[1.6] text-body">
              {frontmatter.excerpt}
            </p>
          </header>
          <div>
            <MDXRemote
              source={body}
              components={MDX_COMPONENTS}
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm],
                },
              }}
            />
          </div>
        </article>
      </div>
      <BackToTop />
    </div>
  );
}

function SportsEventJsonLd({
  doc,
}: {
  doc: NonNullable<ReturnType<typeof partidos.getBySlug>>;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const data = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: doc.frontmatter.title,
    description: doc.frontmatter.excerpt,
    startDate: doc.frontmatter.publishedAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    sport: "Football",
    url: `${baseUrl}/partidos/${doc.frontmatter.slug}`,
    organizer: { "@type": "Organization", name: "Habla!", url: baseUrl },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
