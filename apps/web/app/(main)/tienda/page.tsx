// /tienda — Lote 2 (Abr 2026): página en mantenimiento.
//
// El sistema de Lukas y los canjes se demolieron. Lote 3 elimina la tabla
// Canje + esta ruta. Mientras tanto, la página muestra un cartel.

import Link from "next/link";

export const dynamic = "force-static";

export default function TiendaPage() {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center md:py-24">
      <div aria-hidden className="mb-4 text-5xl">
        🔧
      </div>
      <h1 className="mb-3 font-display text-[28px] font-black uppercase tracking-[0.02em] text-dark md:text-[36px]">
        Tienda en mantenimiento
      </h1>
      <p className="mx-auto mb-6 max-w-[420px] text-[14px] leading-relaxed text-body">
        Estamos rediseñando el sistema de premios. Volvé pronto — mientras
        tanto, seguí prediciendo gratis los partidos y subiendo en el ranking.
      </p>
      <Link
        href="/matches"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:bg-brand-gold-light"
      >
        🎯 Ir a partidos
      </Link>
    </div>
  );
}
