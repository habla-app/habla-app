"use client";

// CasasGrid — Listing filtrable de casas en /casas. Lote B v3.1 (refactor
// mobile-first del Lote 8). Spec:
// docs/ux-spec/02-pista-usuario-publica/casas.spec.md.
//
// Diferencias vs Lote 8:
// - Mobile-first: filtros en sheet colapsable arriba (no sidebar fijo).
// - Touch targets ≥44px en chips, CTAs y botones de filtros.
// - Cards con stack vertical full-width en mobile, grid 2-col en md+.
// - Buscador por nombre con debounce 300ms.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [soloConBono, setSoloConBono] = useState<boolean>(false);
  const [metodosSeleccionados, setMetodosSeleccionados] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [queryInput, setQueryInput] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  // Debounce 300ms del query input (UX mobile: evita re-render por cada
  // tecla mientras se escribe).
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

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
      if (query && !it.nombre.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [items, minRating, soloConBono, metodosSeleccionados, query]);

  const totalActivos =
    (minRating > 0 ? 1 : 0) +
    (soloConBono ? 1 : 0) +
    metodosSeleccionados.size +
    (query ? 1 : 0);

  function toggleMetodo(m: string) {
    setMetodosSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  function reset() {
    setMinRating(0);
    setSoloConBono(false);
    setMetodosSeleccionados(new Set());
    setQueryInput("");
  }

  return (
    <div>
      {/* SEARCH BAR sticky bajo el header */}
      <div className="mb-3">
        <label htmlFor="casa-search" className="sr-only">
          Buscar casa
        </label>
        <div className="relative">
          <span
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-d"
          >
            🔎
          </span>
          <input
            id="casa-search"
            type="search"
            placeholder="Buscar casa..."
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="touch-target h-12 w-full rounded-md border border-light bg-card pl-10 pr-4 text-body-md text-dark placeholder:text-muted-d focus:border-brand-blue-main focus:outline-none focus:ring-2 focus:ring-brand-blue-main/30"
          />
        </div>
      </div>

      {/* FILTROS toggle */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="touch-target inline-flex items-center gap-2 rounded-md border border-light bg-card px-4 py-2.5 text-body-sm font-bold text-dark transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
          aria-expanded={showFilters}
        >
          🎚 Filtros{totalActivos > 0 ? ` (${totalActivos} activo${totalActivos > 1 ? "s" : ""})` : ""}
          <span aria-hidden>{showFilters ? "▴" : "▾"}</span>
        </button>
      </div>

      {showFilters ? (
        <div className="mb-6 rounded-md border border-light bg-card p-4 md:p-5">
          {/* Rating */}
          <div className="mb-4">
            <label
              htmlFor="rating-min"
              className="mb-1 block text-label-md text-dark"
            >
              Rating mínimo:{" "}
              <span className="text-num-sm tabular-nums">
                {minRating.toFixed(1)}
              </span>
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

          {/* Bono */}
          <label className="mb-4 flex items-center gap-2 text-body-md text-dark">
            <input
              type="checkbox"
              checked={soloConBono}
              onChange={(e) => setSoloConBono(e.target.checked)}
              className="h-5 w-5 accent-brand-gold"
            />
            Sólo con bono vigente
          </label>

          {/* Métodos */}
          {todosLosMetodos.length > 0 ? (
            <div>
              <p className="mb-2 text-label-sm text-muted-d">Métodos de pago</p>
              <div className="flex flex-wrap gap-2">
                {todosLosMetodos.map((m) => {
                  const sel = metodosSeleccionados.has(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMetodo(m)}
                      className={`touch-target rounded-full border px-3 py-2 text-body-sm font-bold transition-colors ${
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
          ) : null}

          {totalActivos > 0 ? (
            <div className="mt-4 border-t border-light pt-3">
              <button
                type="button"
                onClick={reset}
                className="touch-target text-body-sm font-bold text-brand-blue-main hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* RESULTS */}
      <p className="mb-3 text-body-xs text-muted-d">
        {filtrados.length} {filtrados.length === 1 ? "casa" : "casas"} ·
        autorizadas por MINCETUR
      </p>

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-light bg-card px-5 py-10 text-center text-body-sm text-muted-d">
          Ninguna casa cumple los filtros seleccionados.{" "}
          <button
            type="button"
            onClick={reset}
            className="font-bold text-brand-blue-main hover:underline"
          >
            Limpiar filtros
          </button>
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtrados.map((it) => (
            <ItemCard key={it.slug} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  return (
    <article className="overflow-hidden rounded-md border border-light bg-card shadow-sm transition-all hover:shadow-md">
      <header className="flex items-center gap-3 border-b border-light bg-subtle px-4 py-3 md:px-5">
        <CasaLogoMini item={item} />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-display text-display-sm uppercase text-dark">
            {item.nombre}
          </h2>
          <div className="mt-0.5 flex items-center gap-2 text-body-xs">
            {item.rating !== null ? (
              <span className="text-num-sm tabular-nums text-dark">
                ★ {item.rating.toFixed(1)}
              </span>
            ) : null}
            <span className="text-label-sm text-brand-blue-main">
              ✓ MINCETUR
            </span>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 md:px-5">
        {item.bonoActual ? (
          <div className="mb-3 rounded-sm border border-brand-gold/30 bg-brand-gold-dim px-3 py-2">
            <div className="text-label-sm text-brand-gold-dark">Bono</div>
            <div className="font-display text-display-xs text-dark">
              {item.bonoActual}
            </div>
          </div>
        ) : null}
        <p className="m-0 line-clamp-3 text-body-sm leading-snug text-body">
          {item.excerpt}
        </p>
        {item.metodosPago.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {item.metodosPago.slice(0, 4).map((m) => (
              <span
                key={m}
                className="inline-block rounded-sm border border-light bg-subtle px-2 py-0.5 text-body-xs font-semibold text-dark"
              >
                {m}
              </span>
            ))}
            {item.metodosPago.length > 4 ? (
              <span className="text-body-xs text-muted-d">
                +{item.metodosPago.length - 4}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <footer className="flex gap-2 border-t border-light bg-subtle/60 px-4 py-3 md:px-5">
        <Link
          href={`/casas/${item.slug}`}
          className="touch-target inline-flex flex-1 items-center justify-center rounded-sm border border-light bg-card px-3 py-2 text-body-sm font-bold text-dark hover:bg-page"
        >
          Ver review
        </Link>
        <Link
          href={`/go/${item.afiliadoSlug}?utm_source=casas&utm_medium=listing`}
          rel="sponsored noopener"
          className="touch-target inline-flex flex-1 items-center justify-center gap-1 rounded-sm bg-brand-gold px-3 py-2 font-display text-label-md text-black shadow-gold-btn hover:-translate-y-px hover:bg-brand-gold-light"
        >
          Ir a {item.nombre} →
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
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm bg-brand-gold font-display text-display-xs text-black shadow-gold-btn"
    >
      {inicial}
    </div>
  );
}
