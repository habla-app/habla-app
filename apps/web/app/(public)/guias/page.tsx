// /guias — Lote 8. Listing de guías editoriales.

import type { Metadata } from "next";
import Link from "next/link";
import * as guias from "@/lib/content/guias";

export const metadata: Metadata = {
  title: "Guías · Habla!",
  description:
    "Guías editoriales de Habla! para entender apuestas deportivas, predicciones, glosario y conceptos básicos para empezar.",
  alternates: { canonical: "/guias" },
  openGraph: {
    title: "Guías | Habla!",
    description:
      "Guías editoriales para empezar a apostar y predecir con criterio.",
  },
};

export default function GuiasIndexPage() {
  const all = guias.getAll();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-10">
      <header className="mb-6">
        <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-label-sm text-brand-blue-main">
          📚 Guías y glosario
        </p>
        <h1 className="font-display text-display-lg leading-tight text-dark md:text-[40px]">
          Aprende lo básico
        </h1>
        <p className="mt-2 text-body-md leading-[1.55] text-body">
          Conceptos, glosario y tutoriales. Pensadas para principiantes,
          útiles también si ya apuestas hace tiempo.
        </p>
      </header>

      {all.length === 0 ? (
        <p className="rounded-md border border-light bg-card px-5 py-10 text-center text-body-sm text-muted-d">
          Estamos preparando las primeras guías. Volvé pronto.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {all.map((d) => (
            <Link
              key={d.frontmatter.slug}
              href={`/guias/${d.frontmatter.slug}`}
              className="group flex flex-col overflow-hidden rounded-md border border-light bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:p-5"
            >
              <div className="mb-2 flex flex-wrap gap-1.5">
                {d.frontmatter.tags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="inline-block rounded-sm bg-brand-blue-main/10 px-2 py-0.5 text-label-sm text-brand-blue-main"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <h2 className="m-0 font-display text-display-sm leading-tight text-dark group-hover:text-brand-blue-main">
                {d.frontmatter.title}
              </h2>
              <p className="mt-2 flex-1 text-body-sm leading-snug text-body">
                {d.frontmatter.excerpt}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
