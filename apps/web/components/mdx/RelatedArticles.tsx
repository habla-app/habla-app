// RelatedArticles — Lote 8.
//
// Server Component. Lee 3 artículos relacionados del loader (matching por
// tags, fallback a últimos publicados) y renderiza cards en el estilo del
// mockup. Si no hay relacionados, devuelve `null` — preferimos ocultar
// el bloque entero antes que mostrar un estado vacío feo.
//
// Uso esperado en MDX:
//   <RelatedArticles slug="dummy" />

import Link from "next/link";
import * as articles from "@/lib/content/articles";

interface Props {
  slug: string;
  /** Cuántos artículos mostrar. Default 3. */
  n?: number;
}

export function RelatedArticles({ slug, n = 3 }: Props) {
  const relacionados = articles.getRelated(slug, n);
  if (relacionados.length === 0) return null;

  return (
    <section className="my-10 border-t border-light pt-8">
      <h2 className="mb-5 font-display text-[20px] font-extrabold uppercase tracking-[0.02em] text-dark">
        Seguí leyendo
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {relacionados.map((d) => (
          <Link
            key={d.frontmatter.slug}
            href={`/blog/${d.frontmatter.slug}`}
            className="group block overflow-hidden rounded-md border border-light bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 flex flex-wrap gap-1.5">
              {d.frontmatter.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="inline-block rounded-sm bg-brand-blue-main/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-brand-blue-main"
                >
                  {t}
                </span>
              ))}
            </div>
            <h3 className="m-0 font-display text-[16px] font-extrabold leading-tight text-dark group-hover:text-brand-blue-main">
              {d.frontmatter.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-muted-d">
              {d.frontmatter.excerpt}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
