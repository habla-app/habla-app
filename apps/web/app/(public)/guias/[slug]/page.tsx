// /guias/[slug] — Lote 8. Guía individual.
//
// Render del .mdx + JSON-LD `Article`. Si el frontmatter declara
// `tipo: "howto"`, además se emite un schema.org/HowTo (los rich results
// de Google de tipo "Cómo hacer X" requieren ese marcado).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import * as guias from "@/lib/content/guias";
import { MDX_COMPONENTS } from "@/lib/content/mdx-components";
import { TOC } from "@/components/mdx/TOC";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { BackToTop } from "@/components/legal/BackToTop";

interface Params {
  slug: string;
}

export function generateStaticParams(): Array<Params> {
  return guias.getMetaEntries().map((e) => ({ slug: e.slug }));
}

export function generateMetadata({
  params,
}: {
  params: Params;
}): Metadata {
  const doc = guias.getBySlug(params.slug);
  if (!doc) return {};
  const { title, excerpt, tags, ogImage, author } = doc.frontmatter;
  return {
    title,
    description: excerpt,
    keywords: tags,
    authors: [{ name: author }],
    alternates: { canonical: `/guias/${params.slug}` },
    openGraph: {
      type: "article",
      title: `${title} | Habla!`,
      description: excerpt,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default function GuiaPage({ params }: { params: Params }) {
  const doc = guias.getBySlug(params.slug);
  if (!doc) notFound();
  const { frontmatter, body, headings } = doc;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14">
      <ArticleJsonLd doc={doc} />
      {frontmatter.tipo === "howto" && (
        <HowToJsonLd doc={doc} />
      )}
      <TrackOnMount
        event="articulo_visto"
        props={{
          slug: frontmatter.slug,
          categoria: "guia",
          titulo: frontmatter.title,
        }}
      />

      <div className="lg:flex lg:gap-10">
        <TOC headings={headings} />
        <article className="min-w-0 flex-1 lg:max-w-[760px]">
          <header className="mb-8">
            <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-brand-blue-main">
              📚 Guía
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

function ArticleJsonLd({ doc }: { doc: NonNullable<ReturnType<typeof guias.getBySlug>> }) {
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
    publisher: { "@type": "Organization", name: "Habla!", url: baseUrl },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}/guias/${frontmatter.slug}`,
    },
    keywords: frontmatter.tags.join(", "),
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

function HowToJsonLd({ doc }: { doc: NonNullable<ReturnType<typeof guias.getBySlug>> }) {
  const { frontmatter, headings } = doc;
  // Cada h2 se considera un "step". Es una aproximación funcional para
  // que las guías howto tengan rich results sin pedirle al editor que
  // marque manualmente cada paso. Si en el futuro se quiere un control
  // más fino, agregamos un campo `pasos: [...]` al frontmatter.
  const steps = headings
    .filter((h) => h.level === 2)
    .map((h, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: h.text,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com"}/guias/${frontmatter.slug}#${h.id}`,
    }));
  if (steps.length === 0) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: frontmatter.title,
    description: frontmatter.excerpt,
    step: steps,
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
