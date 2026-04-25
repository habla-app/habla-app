// /legal/[slug] — Lote 3.
//
// Renderiza uno de los 6 documentos legales del catálogo (terminos,
// privacidad, cookies, juego-responsable, canjes, aviso). El contenido
// vive en `apps/web/content/legal/*.md`. La ruta es estática
// (generateStaticParams) — los slugs son finitos y conocidos.
//
// El layout (apps/web/app/legal/layout.tsx) inyecta NavBar + Footer.
// Este componente solo dibuja el documento + sidebar TOC + back-to-top.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/legal/MarkdownContent";
import { LegalTOC } from "@/components/legal/LegalTOC";
import { BackToTop } from "@/components/legal/BackToTop";
import {
  loadLegalDoc,
  extractHeadings,
  extractVersion,
  LEGAL_DOCS,
  LEGAL_SLUGS,
  type LegalSlug,
} from "@/lib/legal-content";

interface Params {
  slug: string;
}

export function generateStaticParams(): Array<Params> {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const meta = LEGAL_DOCS[params.slug as LegalSlug];
  if (!meta) return {};
  return {
    title: meta.title,
    description: meta.description,
    robots: { index: true, follow: true },
    openGraph: {
      title: `${meta.title} | Habla!`,
      description: meta.description,
    },
  };
}

export default function LegalDocPage({ params }: { params: Params }) {
  const meta = LEGAL_DOCS[params.slug as LegalSlug];
  if (!meta) notFound();

  const content = loadLegalDoc(params.slug);
  if (!content) notFound();

  const headings = extractHeadings(content);
  const version = extractVersion(content);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14">
      <div className="lg:flex lg:gap-10">
        <article className="min-w-0 flex-1 lg:max-w-[760px]">
          {version && (
            <p className="mb-6 inline-block rounded-sm bg-subtle px-3 py-1 text-[12.5px] font-bold uppercase tracking-wider text-muted-d">
              {version}
            </p>
          )}
          <MarkdownContent content={content} />
        </article>
        <LegalTOC headings={headings} />
      </div>
      <BackToTop />
    </div>
  );
}
