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

      {/* Banner compacto — solo mensaje informativo centrado. Variante
          ligera del shop-note del mockup (fondo crema con border gold y
          shimmer dorada superior). Sin balance: el balance vive en el
          stat header global (BalanceBadge) y en /wallet — repetirlo acá
          ya no aporta. Padding vertical reducido (py-2.5) para que el
          banner sea bajo. */}
      <section
        className="relative mb-5 overflow-hidden rounded-md border border-brand-gold/30 bg-gradient-to-br from-alert-success-bg via-card to-card px-4 py-2.5 shadow-sm"
        data-testid="tienda-premios-card"
      >
        <div className="flex items-center justify-center gap-2 text-center text-[12px] leading-relaxed text-body">
          <span aria-hidden className="flex-shrink-0 text-base">
            💡
          </span>
          <p>
            Sólo las{" "}
            <strong className="text-alert-success-text">Lukas ganadas</strong>{" "}
            en torneos sirven para canjear acá
          </p>
        </div>
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
