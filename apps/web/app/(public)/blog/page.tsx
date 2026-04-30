// /blog — Lote 8. Listing público de artículos.
//
// Paginado client-side via query string `?page=N`. 12 artículos por
// página, ordenados por publishedAt DESC (lo provee `articles.getAll()`).
// El listing es server-rendered con ISR (revalidate del layout (public),
// 1h) para que el HTML llegue con todos los meta del head.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import * as articles from "@/lib/content/articles";

export const metadata: Metadata = {
  title: "Blog · Habla!",
  description:
    "Artículos editoriales de Habla! sobre fútbol peruano, predicciones, casas autorizadas por MINCETUR y más.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | Habla!",
    description:
      "Artículos editoriales de Habla! sobre fútbol peruano y apuestas responsables.",
  },
};

const PAGE_SIZE = 12;

interface Props {
  searchParams?: { page?: string };
}

export default function BlogIndexPage({ searchParams }: Props) {
  const all = articles.getAll();
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const requested = Number.parseInt(searchParams?.page ?? "1", 10);
  const page = Number.isFinite(requested) ? Math.max(1, requested) : 1;
  if (page > totalPages) redirect("/blog");

  const start = (page - 1) * PAGE_SIZE;
  const slice = all.slice(start, start + PAGE_SIZE);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-10">
      <header className="mb-6">
        <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-label-sm text-brand-blue-main">
          📰 Blog editorial
        </p>
        <h1 className="font-display text-display-lg leading-tight text-dark md:text-[40px]">
          Análisis del equipo Habla!
        </h1>
        <p className="mt-2 text-body-md leading-[1.55] text-body">
          Liga 1, torneos internacionales, predicciones y operadores
          autorizados por MINCETUR.
        </p>
      </header>

      {slice.length === 0 ? (
        <p className="rounded-md border border-light bg-card px-5 py-10 text-center text-body-sm text-muted-d">
          Todavía no publicamos artículos. Volvé pronto.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {slice.map((d) => (
            <ArticleCard key={d.frontmatter.slug} doc={d} />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}

type Doc = ReturnType<typeof articles.getAll>[number];

function ArticleCard({ doc }: { doc: Doc }) {
  const { slug, title, excerpt, tags, publishedAt, author } = doc.frontmatter;
  return (
    <Link
      href={`/blog/${slug}`}
      className="group flex flex-col overflow-hidden rounded-md border border-light bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex flex-1 flex-col p-4 md:p-5">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="inline-block rounded-sm bg-brand-blue-main/10 px-2 py-0.5 text-label-sm text-brand-blue-main"
            >
              {t}
            </span>
          ))}
        </div>
        <h2 className="m-0 font-display text-display-sm leading-tight text-dark group-hover:text-brand-blue-main">
          {title}
        </h2>
        <p className="mt-2 flex-1 text-body-sm leading-snug text-body">
          {excerpt}
        </p>
        <div className="mt-4 flex items-center justify-between text-body-xs text-muted-d">
          <span>{author}</span>
          <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
        </div>
      </div>
    </Link>
  );
}

function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      className="mt-10 flex items-center justify-center gap-3 text-body-sm"
      aria-label="Paginación"
    >
      {page > 1 ? (
        <Link
          href={page - 1 === 1 ? "/blog" : `/blog?page=${page - 1}`}
          className="touch-target inline-flex items-center rounded-sm border border-light bg-card px-4 py-2 font-bold text-dark hover:bg-subtle"
        >
          ← Anterior
        </Link>
      ) : (
        <span className="touch-target inline-flex items-center rounded-sm border border-light bg-subtle px-4 py-2 font-bold text-soft">
          ← Anterior
        </span>
      )}
      <span className="text-num-sm tabular-nums text-muted-d">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={`/blog?page=${page + 1}`}
          className="touch-target inline-flex items-center rounded-sm border border-light bg-card px-4 py-2 font-bold text-dark hover:bg-subtle"
        >
          Siguiente →
        </Link>
      ) : (
        <span className="touch-target inline-flex items-center rounded-sm border border-light bg-subtle px-4 py-2 font-bold text-soft">
          Siguiente →
        </span>
      )}
    </nav>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-PE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
