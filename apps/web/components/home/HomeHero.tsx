// HomeHero — Lote 11.
//
// Hero editorial de la home. Réplica del lenguaje del mockup
// `.live-hero` (línea 397 de docs/habla-mockup-completo.html): gradient
// navy 100→0 con franja dorada animada arriba, titular grande Barlow
// Condensed, subtítulo y dos CTAs lado a lado (primario dorado +
// secundario ghost).
//
// Componente puro de presentación — no fetchea datos.

import Link from "next/link";

export function HomeHero() {
  return (
    <section className="relative mb-8 overflow-hidden rounded-lg bg-gradient-to-b from-brand-blue-dark via-[#000530] to-[#000420] px-6 py-10 text-white shadow-lg md:px-10 md:py-14">
      {/* Franja dorada animada arriba */}
      <span
        aria-hidden
        className="absolute left-0 right-0 top-0 block h-[5px] animate-shimmer bg-gold-shimmer bg-[length:400px_100%]"
      />
      {/* Decoración con emoji gigante */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-30px] top-[-30px] -rotate-[15deg] select-none text-[200px] leading-none opacity-[0.06] md:text-[260px]"
      >
        ⚽
      </div>

      <div className="relative max-w-2xl">
        <p className="mb-3 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-brand-gold">
          Comunidad gratuita · Premios reales
        </p>
        <h1 className="font-display text-[42px] font-black uppercase leading-[0.95] tracking-[0.01em] text-white md:text-[64px]">
          Habla! Te decimos qué jugar
        </h1>
        <p className="mt-5 text-[15px] leading-[1.6] text-white/80 md:text-[17px]">
          Comunidad gratuita de pronósticos deportivos. Compite por{" "}
          <strong className="text-brand-gold-light">S/ 1,250 cada mes</strong>{" "}
          haciendo tus predicciones — sin gastar un sol.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/pronosticos"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-6 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold md:text-[15px]"
          >
            Ver pronósticos del día
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/comunidad"
            className="inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-white/30 bg-white/[0.06] px-6 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-white backdrop-blur-sm transition-all hover:border-white/60 hover:bg-white/[0.12] md:text-[15px]"
          >
            Compite gratis
          </Link>
        </div>
      </div>
    </section>
  );
}
