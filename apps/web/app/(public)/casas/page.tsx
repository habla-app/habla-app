// /casas — Lote 8. Listing público de casas autorizadas por MINCETUR.
//
// Filtros client-side (rating mín, bono presente, métodos de pago) sobre
// la lista de casas activas. SSR carga la grilla completa; el filtrado
// es interactivo sin tocar BD. Para pocas decenas de casas (que es lo que
// cabe esperar en el universo MINCETUR), filtrar in-memory en el cliente
// es lo más simple y rápido.

import type { Metadata } from "next";
import * as casas from "@/lib/content/casas";
import { CasasGrid } from "@/components/public/CasasGrid";

export const metadata: Metadata = {
  title: "Casas de apuestas autorizadas por MINCETUR · Habla!",
  description:
    "Comparativa de casas de apuestas online autorizadas por MINCETUR en Perú. Reviews, bonos vigentes, métodos de pago y experiencia editorial de Habla!.",
  alternates: { canonical: "/casas" },
  openGraph: {
    title: "Casas autorizadas MINCETUR | Habla!",
    description:
      "Reviews editoriales de las casas de apuestas autorizadas por MINCETUR en Perú.",
  },
};

export default async function CasasIndexPage() {
  const reviews = await casas.getActivas();

  // Pasamos al cliente sólo lo que el filtro necesita.
  const items = reviews.map((r) => ({
    slug: r.doc.frontmatter.slug,
    title: r.doc.frontmatter.title,
    excerpt: r.doc.frontmatter.excerpt,
    afiliadoSlug: r.afiliado!.slug,
    nombre: r.afiliado!.nombre,
    logoUrl: r.afiliado!.logoUrl,
    rating: r.afiliado!.rating,
    bonoActual: r.afiliado!.bonoActual,
    metodosPago: r.afiliado!.metodosPago,
  }));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14">
      <header className="mb-8">
        <h1 className="mb-3 font-display text-[40px] font-black leading-tight text-dark md:text-[48px]">
          Casas autorizadas MINCETUR
        </h1>
        <p className="max-w-[720px] text-[16px] leading-[1.7] text-body">
          Reviews editoriales de las casas de apuestas online autorizadas por
          MINCETUR en Perú. Comparamos bonos, métodos de pago, velocidad de
          retiros y experiencia general — sin maquillaje.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border border-light bg-card px-5 py-10 text-center text-[14px] text-muted-d">
          Estamos terminando las primeras reviews. Volvé pronto.
        </p>
      ) : (
        <CasasGrid items={items} />
      )}
    </div>
  );
}
