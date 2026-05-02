// /pronosticos — Lote 8. Listing de ligas con pronósticos editoriales.

import type { Metadata } from "next";
import Link from "next/link";
import * as pronosticos from "@/lib/content/pronosticos";

export const metadata: Metadata = {
  title: "Pronósticos · Habla!",
  description:
    "Pronósticos editoriales de Habla! para Liga 1 Perú, Mundial 2026, Copa Libertadores y más torneos.",
  alternates: { canonical: "/pronosticos" },
  openGraph: {
    title: "Pronósticos | Habla!",
    description:
      "Pronósticos editoriales de Habla! por liga.",
  },
};

export default function PronosticosIndexPage() {
  const ligas = pronosticos.getMetaEntries();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-10">
      <header className="mb-6">
        <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-label-sm text-brand-blue-main">
          🎯 Pronósticos editoriales
        </p>
        <h1 className="font-display text-display-lg leading-tight text-dark md:text-[40px]">
          Análisis por liga
        </h1>
        <p className="mt-2 text-body-md leading-[1.55] text-body">
          Liga 1 Perú, Champions, La Liga, Premier — cada liga con su previa
          de la fecha en curso.
        </p>
      </header>

      {ligas.length === 0 ? (
        <p className="rounded-md border border-light bg-card px-5 py-10 text-center text-body-sm text-muted-d">
          Estamos preparando los primeros pronósticos. Volvé pronto.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ligas.map((l) => (
            <Link
              key={l.liga}
              href={`/pronosticos/${l.liga}`}
              className="touch-target group flex items-center gap-4 rounded-md border border-light bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:p-5"
            >
              <span
                aria-hidden
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-sm bg-brand-gold-dim text-[22px]"
              >
                ⚽
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="m-0 font-display text-display-sm leading-tight text-dark group-hover:text-brand-blue-main">
                  {l.nombre}
                </h2>
                <p className="mt-0.5 text-body-xs text-muted-d">
                  Pronósticos editoriales
                </p>
              </div>
              <span aria-hidden className="text-muted-d">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
