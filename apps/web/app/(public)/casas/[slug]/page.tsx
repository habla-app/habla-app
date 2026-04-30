// /casas/[slug] — Lote 8. Review completa de una casa.
//
// Render del .mdx + JSON-LD `Review` con `aggregateRating` poblado del
// rating del afiliado. Igual que /blog/[slug], con TOC sticky y
// `articulo_visto` event.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import * as casas from "@/lib/content/casas";
import { MDX_COMPONENTS } from "@/lib/content/mdx-components";
import { TOC } from "@/components/mdx/TOC";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { BackToTop } from "@/components/legal/BackToTop";

interface Params {
  slug: string;
}

export function generateStaticParams(): Array<Params> {
  return casas.getMetaEntries().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const review = await casas.getBySlug(params.slug);
  if (!review) return {};
  const { title, excerpt, tags, ogImage, author } = review.doc.frontmatter;
  return {
    title,
    description: excerpt,
    keywords: tags,
    authors: [{ name: author }],
    alternates: { canonical: `/casas/${params.slug}` },
    openGraph: {
      type: "article",
      title: `${title} | Habla!`,
      description: excerpt,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function CasaReviewPage({ params }: { params: Params }) {
  const review = await casas.getBySlug(params.slug);
  if (!review) notFound();
  const { doc, afiliado } = review;
  const { frontmatter, body, headings } = doc;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-10">
      <ReviewJsonLd
        slug={frontmatter.slug}
        title={frontmatter.title}
        excerpt={frontmatter.excerpt}
        publishedAt={frontmatter.publishedAt}
        updatedAt={frontmatter.updatedAt}
        author={frontmatter.author}
        rating={afiliado?.rating ?? null}
        nombreCasa={afiliado?.nombre ?? frontmatter.title}
      />
      <TrackOnMount
        event="articulo_visto"
        props={{
          slug: frontmatter.slug,
          categoria: "casa-review",
          titulo: frontmatter.title,
          afiliadoSlug: frontmatter.afiliadoSlug,
        }}
      />

      <div className="lg:flex lg:gap-10">
        <TOC headings={headings} />
        <article className="min-w-0 flex-1 lg:max-w-[760px]">
          <header className="mb-6">
            <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-label-sm text-brand-blue-main">
              ✓ Casa autorizada MINCETUR
            </p>
            <h1 className="mb-3 font-display text-display-lg leading-tight text-dark md:text-[40px]">
              {frontmatter.title}
            </h1>
            <p className="text-body-md leading-[1.6] text-body md:text-body-lg">
              {frontmatter.excerpt}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-body-xs text-muted-d">
              <span className="font-bold text-dark">{frontmatter.author}</span>
              <span aria-hidden>·</span>
              <time dateTime={frontmatter.publishedAt}>
                {formatDate(frontmatter.publishedAt)}
              </time>
              {frontmatter.updatedAt !== frontmatter.publishedAt ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Actualizado {formatDate(frontmatter.updatedAt)}</span>
                </>
              ) : null}
            </div>
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

          {afiliado && afiliado.activo && afiliado.autorizadoMincetur ? (
            <div className="mt-10 rounded-md border border-brand-gold/30 bg-brand-gold-dim p-5 text-center">
              <p className="m-0 mb-3 font-display text-display-xs text-brand-gold-dark">
                Reclamá tu bono en {afiliado.nombre}
              </p>
              <Link
                href={`/go/${afiliado.slug}?utm_source=review&utm_medium=cta`}
                rel="sponsored noopener"
                className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-6 py-3.5 font-display text-[15px] font-extrabold uppercase tracking-[0.03em] text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold"
              >
                Ir a {afiliado.nombre} →
              </Link>
              <p className="mt-3 text-body-xs text-muted-d">
                Operador autorizado por MINCETUR. Juega responsablemente. +18.
              </p>
            </div>
          ) : null}
        </article>
      </div>
      <BackToTop />
    </div>
  );
}

function ReviewJsonLd({
  slug,
  title,
  excerpt,
  publishedAt,
  updatedAt,
  author,
  rating,
  nombreCasa,
}: {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  author: string;
  rating: number | null;
  nombreCasa: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Review",
    headline: title,
    description: excerpt,
    datePublished: publishedAt,
    dateModified: updatedAt,
    author: { "@type": "Organization", name: author },
    publisher: { "@type": "Organization", name: "Habla!", url: baseUrl },
    itemReviewed: {
      "@type": "Organization",
      name: nombreCasa,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}/casas/${slug}`,
    },
  };
  if (rating !== null) {
    data.reviewRating = {
      "@type": "Rating",
      ratingValue: rating,
      bestRating: 5,
      worstRating: 0,
    };
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-PE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
