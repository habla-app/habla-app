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
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14">
      <header className="mb-8">
        <h1 className="mb-3 font-display text-[40px] font-black leading-tight text-dark md:text-[48px]">
          Guías
        </h1>
        <p className="max-w-[720px] text-[16px] leading-[1.7] text-body">
          Conceptos, glosarios y tutoriales para entender el ecosistema de
          predicciones deportivas y apuestas. Pensadas para principiantes,
          útiles también si ya jugás hace tiempo.
        </p>
      </header>

      {all.length === 0 ? (
        <p className="rounded-md border border-light bg-card px-5 py-10 text-center text-[14px] text-muted-d">
          Estamos preparando las primeras guías. Volvé pronto.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {all.map((d) => (
            <Link
              key={d.frontmatter.slug}
              href={`/guias/${d.frontmatter.slug}`}
              className="group flex flex-col overflow-hidden rounded-md border border-light bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-2 flex flex-wrap gap-1.5">
                {d.frontmatter.tags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="inline-block rounded-sm bg-brand-blue-main/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-brand-blue-main"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <h2 className="m-0 font-display text-[18px] font-extrabold leading-tight text-dark group-hover:text-brand-blue-main">
                {d.frontmatter.title}
              </h2>
              <p className="mt-2 flex-1 text-[14px] leading-snug text-body">
                {d.frontmatter.excerpt}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
