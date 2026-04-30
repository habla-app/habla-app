// /pronosticos/[liga] — Lote 8. Pronósticos de una liga.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import * as pronosticos from "@/lib/content/pronosticos";
import { MDX_COMPONENTS } from "@/lib/content/mdx-components";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { BackToTop } from "@/components/legal/BackToTop";
import { NewsletterCTA } from "@/components/marketing/NewsletterCTA";

interface Params {
  liga: string;
}

export function generateStaticParams(): Array<Params> {
  return pronosticos.getMetaEntries().map((e) => ({ liga: e.liga }));
}

export function generateMetadata({
  params,
}: {
  params: Params;
}): Metadata {
  const doc = pronosticos.getByLiga(params.liga);
  if (!doc) return {};
  const { title, excerpt, tags, ogImage, author } = doc.frontmatter;
  return {
    title,
    description: excerpt,
    keywords: tags,
    authors: [{ name: author }],
    alternates: { canonical: `/pronosticos/${params.liga}` },
    openGraph: {
      type: "article",
      title: `${title} | Habla!`,
      description: excerpt,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default function PronosticosLigaPage({ params }: { params: Params }) {
  const doc = pronosticos.getByLiga(params.liga);
  if (!doc) notFound();
  const { frontmatter, body } = doc;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6 md:py-10">
      <TrackOnMount
        event="articulo_visto"
        props={{
          slug: frontmatter.slug,
          categoria: "pronosticos",
          titulo: frontmatter.title,
          liga: frontmatter.liga,
        }}
      />
      <header className="mb-6">
        <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-label-sm text-brand-blue-main">
          🎯 Pronósticos
        </p>
        <h1 className="mb-3 font-display text-display-lg leading-tight text-dark md:text-[40px]">
          {frontmatter.title}
        </h1>
        <p className="text-body-md leading-[1.6] text-body md:text-body-lg">
          {frontmatter.excerpt}
        </p>
      </header>
      <article>
        <MDXRemote
          source={body}
          components={MDX_COMPONENTS}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
            },
          }}
        />
      </article>
      <NewsletterCTA fuente="pronosticos" />
      <BackToTop />
    </div>
  );
}
