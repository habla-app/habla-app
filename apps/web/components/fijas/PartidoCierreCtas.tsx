"use client";
// PartidoCierreCtas — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-fijas-detail .partido-cierre-ctas.
//
// CTAs de cierre al final de /las-fijas/[slug]. Dos slots cuyo contenido
// depende del estado de auth via <AuthGate>:
//   1) Liga: siempre visible. Linkea a /liga/[slug] si hay partidoSlug.
//   2) Socios: visible para Visitor + Free → "Conocer Socios" → /socios.
//      Visible para Socios → "Ir a mi hub Socios" → /socios-hub.

import Link from "next/link";
import { AuthGate } from "@/components/auth/AuthGate";

interface Props {
  partidoSlug: string;
}

export function PartidoCierreCtas({ partidoSlug }: Props) {
  return (
    <section
      aria-label="Acciones de cierre"
      className="mt-6 grid gap-3 md:grid-cols-2"
    >
      <Link
        href={`/liga/${partidoSlug}`}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-4 font-display text-label-md font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light"
      >
        🏆 Armá tu combinada en la Liga
      </Link>

      <AuthGate
        not="socios"
        fallback={
          <Link
            href="/socios-hub"
            className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-brand-gold/60 bg-card px-5 py-4 font-display text-label-md font-extrabold uppercase tracking-[0.04em] text-brand-gold-dark transition-colors hover:border-brand-gold hover:bg-brand-gold/10"
          >
            💎 Ir a mi hub Socios
          </Link>
        }
      >
        <Link
          href="/socios"
          className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-brand-gold/60 bg-card px-5 py-4 font-display text-label-md font-extrabold uppercase tracking-[0.04em] text-brand-gold-dark transition-colors hover:border-brand-gold hover:bg-brand-gold/10"
        >
          💎 Conocer Socios
        </Link>
      </AuthGate>
    </section>
  );
}
