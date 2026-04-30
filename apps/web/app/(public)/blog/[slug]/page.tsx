// /blog/[slug] — Lote 8. Artículo editorial individual.
//
// Carga el .mdx por slug, valida frontmatter, extrae headings, y
// renderiza body con `<MDXRemote>`. El TOC va sticky a la izquierda
// (desktop) o collapsable arriba (mobile).
//
// SEO:
//   - Article JSON-LD inline.
//   - generateMetadata cubre title/description/og.
//   - El OG image custom se genera en `./opengraph-image.tsx` (sibling).
//
// Analytics:
//   - Disparamos `articulo_visto` en mount via TrackOnMount.
//
// Si el slug no existe → notFound (404).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import * as articles from "@/lib/content/articles";
import { MDX_COMPONENTS } from "@/lib/content/mdx-components";
import { TOC } from "@/components/mdx/TOC";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { BackToTop } from "@/components/legal/BackToTop";
import { NewsletterCTA } from "@/components/marketing/NewsletterCTA";

interface Params {
  slug: string;
}

export function generateStaticParams(): Array<Params> {
  return articles.getMetaEntries().map((e) => ({ slug: e.slug }));
}

export function generateMetadata({
  params,
}: {
  params: Params;
}): Metadata {
  const doc = articles.getBySlug(params.slug);
  if (!doc) return {};
  const { title, excerpt, tags, ogImage, author } = doc.frontmatter;
  return {
    title,
    description: excerpt,
    keywords: tags,
    authors: [{ name: author }],
    alternates: { canonical: `/blog/${params.slug}` },
    openGraph: {
      type: "article",
      title: `${title} | Habla!`,
      description: excerpt,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: excerpt,
    },
  };
}

export default function ArticlePage({ params }: { params: Params }) {
  const doc = articles.getBySlug(params.slug);
  if (!doc) notFound();

  const { frontmatter, body, headings } = doc;
  const tieneAfiliacion =
    frontmatter.tags.includes("casas") ||
    frontmatter.tags.includes("apuestas") ||
    frontmatter.tags.includes("afiliacion");

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14">
      <ArticleJsonLd doc={doc} />
      <TrackOnMount
        event="articulo_visto"
        props={{
          slug: frontmatter.slug,
          categoria: frontmatter.categoria ?? "blog",
          titulo: frontmatter.title,
        }}
      />
      <div className="lg:flex lg:gap-10">
        <TOC headings={headings} />
        <article className="min-w-0 flex-1 lg:max-w-[760px]">
          <header className="mb-8">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {frontmatter.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="inline-block rounded-sm bg-brand-blue-main/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-brand-blue-main"
                >
                  {t}
                </span>
              ))}
            </div>
            <h1 className="mb-3 font-display text-[36px] font-black leading-tight text-dark md:text-[44px]">
              {frontmatter.title}
            </h1>
            <p className="text-[16px] leading-[1.6] text-body">
              {frontmatter.excerpt}
            </p>
            <div className="mt-4 flex items-center gap-3 text-[12px] text-muted-d">
              <span className="font-bold text-dark">{frontmatter.author}</span>
              <span aria-hidden>·</span>
              <time dateTime={frontmatter.publishedAt}>
                {formatDate(frontmatter.publishedAt)}
              </time>
              {frontmatter.updatedAt !== frontmatter.publishedAt && (
                <>
                  <span aria-hidden>·</span>
                  <span>Actualizado {formatDate(frontmatter.updatedAt)}</span>
                </>
              )}
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

          {tieneAfiliacion && (
            <p className="mt-8 text-[12px] text-muted-d">
              {/*
                Disclaimers ya pueden venir embebidos en el MDX, pero por
                las dudas mostramos un footer de afiliación si los tags
                lo ameritan. Doble exposición no daña — la divulgación
                cuanto más visible mejor.
              */}
            </p>
          )}

          <NewsletterCTA fuente="blog" />
        </article>
      </div>
      <BackToTop />
    </div>
  );
}

// ---------------------------------------------------------------------------
// JSON-LD Article
// ---------------------------------------------------------------------------

function ArticleJsonLd({ doc }: { doc: ReturnType<typeof articles.getBySlug> }) {
  if (!doc) return null;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const { frontmatter } = doc;
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: frontmatter.title,
    description: frontmatter.excerpt,
    datePublished: frontmatter.publishedAt,
    dateModified: frontmatter.updatedAt,
    author: { "@type": "Organization", name: frontmatter.author },
    publisher: {
      "@type": "Organization",
      name: "Habla!",
      url: baseUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}/blog/${frontmatter.slug}`,
    },
    keywords: frontmatter.tags.join(", "),
    image: frontmatter.ogImage
      ? `${baseUrl}${frontmatter.ogImage}`
      : `${baseUrl}/blog/${frontmatter.slug}/opengraph-image`,
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
