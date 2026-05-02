// /reviews-y-guias — Lote K v3.2 (May 2026).
// Landing hub del producto "Reviews y Guías" — fusiona los antiguos /casas
// y /guias bajo una sola URL.
//
// Este lote (K · Foundation) entrega un landing simple con dos secciones
// inline + CTAs a las sub-rutas. Lote N reescribe la vista con tabs
// completas según el mockup v3.2 (`docs/habla-mockup-v3.2.html`,
// vistas reviews-y-guias-mobile + reviews-y-guias-desktop).
//
// Las sub-rutas /reviews-y-guias/casas y /reviews-y-guias/guias siguen
// funcionando como pages independientes durante la transición — el cambio
// de UX a tabs ocurrirá sobre este page.tsx en Lote N.

import type { Metadata } from "next";
import Link from "next/link";
import * as casas from "@/lib/content/casas";
import * as guias from "@/lib/content/guias";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Reviews y guías · Habla!",
  description:
    "Reviews editoriales de casas autorizadas MINCETUR + guías para apostar con criterio. Todo en un solo lugar.",
  alternates: { canonical: "/reviews-y-guias" },
  openGraph: {
    title: "Reviews y guías | Habla!",
    description:
      "Reviews de casas + guías editoriales para empezar y mejorar tus apuestas.",
  },
};

export default async function ReviewsYGuiasIndexPage() {
  const reviewsActivas = await casas.getActivas().catch(() => []);
  const guiasAll = guias.getAll();

  const casasItems = reviewsActivas.slice(0, 6).map((r) => ({
    slug: r.doc.frontmatter.slug,
    nombre: r.afiliado!.nombre,
    excerpt: r.doc.frontmatter.excerpt,
    rating: r.afiliado!.rating,
  }));

  const guiasItems = guiasAll.slice(0, 6).map((d) => ({
    slug: d.frontmatter.slug,
    title: d.frontmatter.title,
    excerpt: d.frontmatter.excerpt,
  }));

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-10">
      <header className="mb-8">
        <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-label-sm text-brand-blue-main">
          🛡️📚 Reviews y guías
        </p>
        <h1 className="font-display text-display-lg leading-tight text-dark md:text-[40px]">
          Casas autorizadas y guías para apostar con criterio
        </h1>
        <p className="mt-2 text-body-md leading-[1.55] text-body">
          {casasItems.length} casas autorizadas MINCETUR · {guiasAll.length} guías
          editoriales · todo en un solo lugar.
        </p>
      </header>

      {/* Sección Casas — Lote N: pasa a tab. */}
      <section className="mb-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-display-sm font-extrabold text-dark">
            Casas autorizadas
          </h2>
          <Link
            href="/reviews-y-guias/casas"
            className="text-label-md font-semibold text-brand-blue-main hover:underline"
          >
            Ver todas →
          </Link>
        </div>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {casasItems.map((c) => (
            <li
              key={c.slug}
              className="rounded-md border border-strong bg-card p-4 transition-shadow hover:shadow-md"
            >
              <Link href={`/reviews-y-guias/casas/${c.slug}`} className="block">
                <h3 className="font-display text-body-lg font-bold text-dark">
                  {c.nombre}
                </h3>
                <p className="mt-1 text-body-sm leading-[1.5] text-body line-clamp-2">
                  {c.excerpt}
                </p>
                {c.rating ? (
                  <p className="mt-2 text-label-sm text-brand-gold-dark">
                    ⭐ {c.rating.toString()}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Sección Guías — Lote N: pasa a tab. */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-display-sm font-extrabold text-dark">
            Guías
          </h2>
          <Link
            href="/reviews-y-guias/guias"
            className="text-label-md font-semibold text-brand-blue-main hover:underline"
          >
            Ver todas →
          </Link>
        </div>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guiasItems.map((g) => (
            <li
              key={g.slug}
              className="rounded-md border border-strong bg-card p-4 transition-shadow hover:shadow-md"
            >
              <Link href={`/reviews-y-guias/guias/${g.slug}`} className="block">
                <h3 className="font-display text-body-lg font-bold text-dark">
                  {g.title}
                </h3>
                <p className="mt-1 text-body-sm leading-[1.5] text-body line-clamp-2">
                  {g.excerpt}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
