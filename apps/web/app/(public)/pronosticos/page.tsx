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
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14">
      <header className="mb-8">
        <h1 className="mb-3 font-display text-[40px] font-black leading-tight text-dark md:text-[48px]">
          Pronósticos
        </h1>
        <p className="max-w-[720px] text-[16px] leading-[1.7] text-body">
          Análisis editorial de los partidos próximos, fecha por fecha, liga
          por liga. Cada liga abre con la previa de la fecha en curso y se
          actualiza durante la semana.
        </p>
      </header>

      {ligas.length === 0 ? (
        <p className="rounded-md border border-light bg-card px-5 py-10 text-center text-[14px] text-muted-d">
          Estamos preparando los primeros pronósticos. Volvé pronto.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ligas.map((l) => (
            <Link
              key={l.liga}
              href={`/pronosticos/${l.liga}`}
              className="group flex items-center gap-4 rounded-md border border-light bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                aria-hidden
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-sm bg-brand-gold-dim text-[22px]"
              >
                ⚽
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="m-0 font-display text-[18px] font-extrabold leading-tight text-dark group-hover:text-brand-blue-main">
                  {l.nombre}
                </h2>
                <p className="mt-0.5 text-[12px] text-muted-d">
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
