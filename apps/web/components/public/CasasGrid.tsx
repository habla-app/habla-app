"use client";

// CasasGrid — Lote 8. Grid filtrable de casas en /casas.
//
// Filtros:
//   - Rating mínimo (slider 0-5).
//   - Solo con bono presente (checkbox).
//   - Métodos de pago (chips toggleables).
//
// Filtro client-side sobre la lista que SSR ya entregó. Para Lote 14
// donde las casas pueden ser ~20-30, esto rinde sin necesidad de paginar.
// Si el universo crece a >100, mover a server-side filtering vía URL
// params.

import Link from "next/link";
import { useMemo, useState } from "react";

interface Item {
  slug: string;
  title: string;
  excerpt: string;
  afiliadoSlug: string;
  nombre: string;
  logoUrl: string | null;
  rating: number | null;
  bonoActual: string | null;
  metodosPago: string[];
}

interface Props {
  items: Item[];
}

export function CasasGrid({ items }: Props) {
  const [minRating, setMinRating] = useState<number>(0);
  const [soloConBono, setSoloConBono] = useState<boolean>(false);
  const [metodosSeleccionados, setMetodosSeleccionados] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const todosLosMetodos = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) for (const m of it.metodosPago) set.add(m);
    return [...set].sort();
  }, [items]);

  const filtrados = useMemo(() => {
    return items.filter((it) => {
      if ((it.rating ?? 0) < minRating) return false;
      if (soloConBono && !it.bonoActual) return false;
      if (metodosSeleccionados.size > 0) {
        const tieneAlguno = it.metodosPago.some((m) =>
          metodosSeleccionados.has(m),
        );
        if (!tieneAlguno) return false;
      }
      return true;
    });
  }, [items, minRating, soloConBono, metodosSeleccionados]);

  function toggleMetodo(m: string) {
    setMetodosSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
      {/* Sidebar filtros */}
      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="rounded-md border border-light bg-card p-5">
          <p className="mb-4 font-display text-[12px] font-bold uppercase tracking-wider text-muted-d">
            Filtros
          </p>

          <div className="mb-5">
            <label
              htmlFor="rating-min"
              className="mb-1 block text-[12px] font-bold text-dark"
            >
              Rating mínimo:{" "}
              <span className="font-mono">{minRating.toFixed(1)}</span>
            </label>
            <input
              id="rating-min"
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={minRating}
              onChange={(e) => setMinRating(Number.parseFloat(e.target.value))}
              className="w-full accent-brand-gold"
            />
          </div>

          <label className="mb-5 flex items-center gap-2 text-[13px] text-dark">
            <input
              type="checkbox"
              checked={soloConBono}
              onChange={(e) => setSoloConBono(e.target.checked)}
              className="h-4 w-4 accent-brand-gold"
            />
            Sólo con bono vigente
          </label>

          {todosLosMetodos.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-d">
                Métodos de pago
              </p>
              <div className="flex flex-wrap gap-1.5">
                {todosLosMetodos.map((m) => {
                  const sel = metodosSeleccionados.has(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMetodo(m)}
                      className={`rounded-sm border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        sel
                          ? "border-brand-gold bg-brand-gold/15 text-brand-gold-dark"
                          : "border-light bg-subtle text-dark hover:bg-card"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Grilla */}
      <div className="min-w-0">
        <p className="mb-4 text-[12px] text-muted-d">
          {filtrados.length} {filtrados.length === 1 ? "casa" : "casas"} —{" "}
          autorizadas por MINCETUR
        </p>
        {filtrados.length === 0 ? (
          <p className="rounded-md border border-light bg-card px-5 py-10 text-center text-[14px] text-muted-d">
            Ninguna casa cumple los filtros seleccionados.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {filtrados.map((it) => (
              <ItemCard key={it.slug} item={it} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  return (
    <article className="overflow-hidden rounded-md border border-light bg-card shadow-sm transition-all hover:shadow-md">
      <header className="flex items-center gap-3 border-b border-light bg-subtle px-5 py-4">
        <CasaLogoMini item={item} />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-display text-[18px] font-black uppercase tracking-[0.02em] text-dark">
            {item.nombre}
          </h2>
          <div className="mt-0.5 flex items-center gap-2 text-[11px]">
            {item.rating !== null ? (
              <span className="font-mono font-bold text-dark">
                ★ {item.rating.toFixed(1)}
              </span>
            ) : null}
            <span className="font-bold uppercase tracking-[0.05em] text-brand-blue-main">
              ✓ MINCETUR
            </span>
          </div>
        </div>
      </header>

      <div className="px-5 py-4">
        {item.bonoActual && (
          <div className="mb-3 rounded-sm border border-brand-gold/30 bg-brand-gold-dim px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand-gold-dark">
              Bono
            </div>
            <div className="font-display text-[14px] font-black text-dark">
              {item.bonoActual}
            </div>
          </div>
        )}
        <p className="m-0 line-clamp-3 text-[13px] leading-snug text-body">
          {item.excerpt}
        </p>
        {item.metodosPago.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {item.metodosPago.slice(0, 4).map((m) => (
              <span
                key={m}
                className="inline-block rounded-sm border border-light bg-subtle px-2 py-0.5 text-[10px] font-semibold text-dark"
              >
                {m}
              </span>
            ))}
            {item.metodosPago.length > 4 ? (
              <span className="text-[10px] text-muted-d">
                +{item.metodosPago.length - 4}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <footer className="flex gap-2 border-t border-light bg-subtle/60 px-5 py-3">
        <Link
          href={`/casas/${item.slug}`}
          className="inline-flex flex-1 items-center justify-center rounded-sm border border-light bg-card px-3 py-2 text-[12px] font-bold text-dark hover:bg-page"
        >
          Ver review
        </Link>
        <Link
          href={`/go/${item.afiliadoSlug}`}
          rel="sponsored noopener"
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-sm bg-brand-gold px-3 py-2 font-display text-[12px] font-extrabold uppercase tracking-[0.03em] text-black shadow-gold-btn hover:-translate-y-px hover:bg-brand-gold-light"
        >
          Ir a {item.nombre}
          <span aria-hidden>→</span>
        </Link>
      </footer>
    </article>
  );
}

function CasaLogoMini({ item }: { item: Item }) {
  if (item.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.logoUrl}
        alt={`Logo ${item.nombre}`}
        className="h-10 w-10 flex-shrink-0 rounded-sm bg-card object-contain shadow-sm"
      />
    );
  }
  const inicial = item.nombre.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      aria-hidden
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm bg-brand-gold font-display text-[16px] font-black text-black shadow-gold-btn"
    >
      {inicial}
    </div>
  );
}
