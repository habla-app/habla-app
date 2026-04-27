"use client";
// TiendaContent — orquesta /tienda (Sub-Sprint 6).
// Lote 6B: stats muestra balance Ganados (canjeables) en lugar del total.
// Lote 6C: elimina los 3 cuadros de stats (Canjeables/Disp. ahora/Ya canjeados).
// Muestra solo el balance de Lukas Premios con label "Disponibles para canjear".
// Nuevo mensaje descriptivo enfatiza que son Lukas Premios las que funcionan acá.

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import type { PremioDTO } from "@/lib/services/premios.service";
import { useLukasStore } from "@/stores/lukas.store";
import { CatFilters } from "./CatFilters";
import { PrizeCardV2 } from "./PrizeCardV2";
import { FeaturedPrize } from "./FeaturedPrize";

interface TiendaContentProps {
  premios: PremioDTO[];
  featured: PremioDTO | null;
  categoriaActiva:
    | "ENTRADA"
    | "CAMISETA"
    | "GIFT"
    | "TECH"
    | "EXPERIENCIA"
    | null;
  initialBalance: number | null;
  initialBalanceGanadas: number;
  totalCanjeados: number;
  isLoggedIn: boolean;
}

export function TiendaContent({
  premios,
  featured,
  categoriaActiva,
  initialBalance,
  initialBalanceGanadas,
  totalCanjeados,
  isLoggedIn,
}: TiendaContentProps) {
  const balanceStore = useLukasStore((s) => s.balance);
  const balance = balanceStore || initialBalance || 0;

  // ganadas: solo los Lukas que pueden canjearse en /tienda.
  // Se actualiza optimistamente tras cada canje exitoso.
  const [ganadas, setGanadas] = useState(initialBalanceGanadas);

  const handleCanjeado = useCallback((costeLukas: number) => {
    setGanadas((prev) => Math.max(0, prev - costeLukas));
  }, []);

  const grid = useMemo(
    () => premios.filter((p) => !p.featured || p.id !== featured?.id),
    [premios, featured],
  );

  return (
    <div className="mx-auto max-w-[960px] px-4 py-6 md:py-10">
      <header className="mb-5">
        <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark">
          🎁 Tienda de premios
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
          Canjea tus Lukas por experiencias y productos reales
        </p>
      </header>

      {/* Banner split horizontal dark — izq balance Lukas Premios sobre
          fondo blue-dark, der explicación sobre fondo dark-card (un tono
          más claro). Sin bordes internos visibles excepto un separador
          sutil. Mobile: stack vertical (separador horizontal). Mismo dato
          que el card combinado anterior, solo cambia presentación. */}
      <section
        className="mb-6 flex flex-col overflow-hidden rounded-md shadow-md sm:flex-row"
        data-testid="tienda-premios-card"
      >
        {isLoggedIn ? (
          <>
            {/* Lado izq (~40%) — balance, fondo blue-dark */}
            <div className="bg-dark-surface px-5 py-4 sm:w-[40%] sm:flex-shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-gold/80">
                Lukas para canjear
              </div>
              <div
                className="mt-1 font-display text-[36px] font-black leading-none text-brand-gold [text-shadow:0_4px_20px_rgba(255,184,0,0.25)] sm:text-[40px]"
                data-testid="tienda-balance-amount"
              >
                {ganadas.toLocaleString("es-PE")}{" "}
                <span aria-hidden className="align-middle text-[0.55em]">
                  🪙
                </span>
              </div>
            </div>

            {/* Separador sutil — horizontal en mobile, vertical en desktop */}
            <div
              aria-hidden
              className="h-px w-full flex-shrink-0 bg-dark-border sm:h-auto sm:w-px"
            />

            {/* Lado der (~60%) — explicación, fondo dark-card */}
            <div className="flex flex-1 items-start gap-2 bg-dark-card px-5 py-4 text-[12px] leading-relaxed text-white/70">
              <span aria-hidden className="flex-shrink-0 text-base">
                💡
              </span>
              <p>
                Sólo las Lukas ganadas en torneos sirven para canjear acá
              </p>
            </div>
          </>
        ) : (
          /* Anónimo — usa fila única con el mismo fondo dark-card */
          <div className="flex items-start gap-2 bg-dark-card px-5 py-4 text-[12px] leading-relaxed text-white/70">
            <span aria-hidden className="flex-shrink-0 text-base">
              💡
            </span>
            <p>
              Sólo las Lukas ganadas en torneos sirven para canjear acá
            </p>
          </div>
        )}
      </section>

      {featured ? (
        <FeaturedPrize
          premio={featured}
          balanceActual={balance}
          balanceGanadas={ganadas}
          onCanjeado={handleCanjeado}
        />
      ) : null}

      <h2 className="mb-3.5 flex items-center gap-2.5 font-display text-[22px] font-black uppercase tracking-[0.02em] text-dark">
        <span aria-hidden>🛍️</span> Todos los premios
      </h2>

      <CatFilters activa={categoriaActiva} />

      {grid.length === 0 ? (
        <div className="mb-8 rounded-md border border-light bg-card px-6 py-12 text-center shadow-sm">
          <div aria-hidden className="text-5xl">
            🎁
          </div>
          <h3 className="mt-4 font-display text-xl font-extrabold uppercase tracking-wide text-dark">
            No hay premios en esta categoría
          </h3>
          <p className="mt-2 text-sm text-muted-d">
            Probá con otra categoría — estamos sumando premios nuevos cada
            semana.
          </p>
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {grid.map((premio) => (
            <PrizeCardV2
              key={premio.id}
              premio={premio}
              balanceActual={balance}
              balanceGanadas={ganadas}
              onCanjeado={handleCanjeado}
            />
          ))}
        </div>
      )}

      <ShopEarnCta isLoggedIn={isLoggedIn} />
    </div>
  );
}

function ShopEarnCta({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-lg bg-hero-blue px-6 py-7 text-center text-white shadow-md md:px-10 md:py-8">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-5 -top-8 text-[140px] leading-none opacity-[0.08]"
      >
        🎯
      </span>
      <h2 className="relative font-display text-[28px] font-black uppercase text-white">
        {isLoggedIn ? "¿Necesitas más Lukas?" : "¿Todavía no tienes Lukas?"}
      </h2>
      <p className="relative mx-auto mt-2 max-w-xl text-sm text-white/85">
        {isLoggedIn
          ? "Sigue jugando torneos para ganar premios. El pozo se reparte entre los 10 mejores: primer lugar se lleva el 45%."
          : "Entra y juega torneos gratis con el bonus de bienvenida de 500 🪙."}
      </p>
      <div className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-2.5">
        <Link
          href={isLoggedIn ? "/matches" : "/auth/signin?callbackUrl=/tienda"}
          className="inline-flex items-center gap-2 rounded-sm bg-brand-gold px-6 py-3 text-sm font-bold text-black shadow-gold-btn transition hover:bg-brand-gold-light hover:-translate-y-0.5"
        >
          {isLoggedIn ? "⚽ Ver partidos" : "Iniciar sesión"}
        </Link>
        <Link
          href={isLoggedIn ? "/wallet" : "/matches"}
          className="inline-flex items-center gap-2 rounded-sm border border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
        >
          {isLoggedIn ? "💳 Comprar Lukas" : "Ver torneos"}
        </Link>
      </div>
    </section>
  );
}
