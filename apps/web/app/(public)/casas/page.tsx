// /casas — Listing público de casas autorizadas MINCETUR (Lote B v3.1).
// Spec: docs/ux-spec/02-pista-usuario-publica/casas.spec.md.
//
// Refactor visual del Lote 8: layout mobile-first con stack vertical y
// filtros más simples (rating, bono, métodos de pago) usando bottom-sheet
// en mobile. La lógica de datos del Lote 7-8 (afiliación + verificación
// MINCETUR) se mantiene intacta.

import type { Metadata } from "next";
import * as casas from "@/lib/content/casas";
import { CasasGrid } from "@/components/public/CasasGrid";

export const metadata: Metadata = {
  title: "Casas de apuestas autorizadas por MINCETUR · Habla!",
  description:
    "Comparativa editorial de las casas de apuestas online autorizadas por MINCETUR en Perú. Bonos vigentes, métodos de pago y mejores cuotas por partido.",
  alternates: { canonical: "/casas" },
  openGraph: {
    title: "Casas autorizadas MINCETUR | Habla!",
    description:
      "Reviews editoriales de las casas de apuestas autorizadas por MINCETUR en Perú.",
  },
};

export default async function CasasIndexPage() {
  const reviews = await casas.getActivas();

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
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-10">
      <header className="mb-6">
        <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-label-sm text-brand-blue-main">
          🛡️ Verificadas MINCETUR
        </p>
        <h1 className="font-display text-display-lg leading-tight text-dark md:text-[40px]">
          Casas autorizadas en Perú
        </h1>
        <p className="mt-2 text-body-md leading-[1.55] text-body">
          {items.length} casas autorizadas · reviews editoriales · cuotas
          comparadas en cada partido top.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border border-light bg-card px-5 py-10 text-center text-body-sm text-muted-d">
          Estamos terminando las primeras reviews. Volvé pronto.
        </p>
      ) : (
        <CasasGrid items={items} />
      )}
    </div>
  );
}
