// TiendaContent — orquesta /tienda. Sub-Sprint 6.
//
// Server-side: recibe premios + featured + balance inicial via props.
// Client-side: maneja filtros vía URL, sincroniza balance con store,
// re-renderiza grid al cambiar categoría.
"use client";

import { useMemo } from "react";
import type { PremioDTO } from "@/lib/services/premios.service";
import { useLukasStore } from "@/stores/lukas.store";
import { CatFilters } from "./CatFilters";
import { PrizeCardV2 } from "./PrizeCardV2";
import { FeaturedPrize } from "./FeaturedPrize";

interface TiendaContentProps {
  premios: PremioDTO[];
  featured: PremioDTO | null;
  categoriaActiva: "ENTRADA" | "CAMISETA" | "GIFT" | "TECH" | "EXPERIENCIA" | null;
  initialBalance: number | null;
  totalCanjeados: number;
  isLoggedIn: boolean;
}

export function TiendaContent({
  premios,
  featured,
  categoriaActiva,
  initialBalance,
  totalCanjeados,
  isLoggedIn,
}: TiendaContentProps) {
  const balanceStore = useLukasStore((s) => s.balance);
  const balance = balanceStore || initialBalance || 0;

  const canjeablesAhora = useMemo(
    () => premios.filter((p) => p.stock > 0 && balance >= p.costeLukas).length,
    [premios, balance],
  );

  const grid = useMemo(
    () => premios.filter((p) => !p.featured || p.id !== featured?.id),
    [premios, featured],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:py-10">
      <header>
        <h1 className="font-display text-[28px] font-extrabold text-dark md:text-[36px]">
          🎁 Tienda de premios
        </h1>
        <p className="mt-1 text-body">
          Cambiá tus Lukas por premios reales.
        </p>
      </header>

      {isLoggedIn && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard
            label="Tu balance"
            value={`${balance} 🪙`}
            tone="gold"
          />
          <StatCard
            label="Canjeables ahora"
            value={`${canjeablesAhora}`}
            tone="green"
          />
          <StatCard
            label="Ya canjeados"
            value={`${totalCanjeados}`}
            tone="blue"
          />
        </div>
      )}

      <div className="rounded-md bg-alert-info-bg border border-alert-info-border px-4 py-3 text-[13px] text-alert-info-text">
        💡 Los Lukas son créditos para canjear premios. <strong>No se retiran
        como efectivo</strong> — Habla! es un torneo de habilidad, no un
        juego de apuestas.
      </div>

      {featured && (
        <section>
          <FeaturedPrize premio={featured} balanceActual={balance} />
        </section>
      )}

      <section>
        <CatFilters activa={categoriaActiva} />
      </section>

      <section>
        {grid.length === 0 ? (
          <div className="rounded-lg border border-light bg-card px-6 py-12 text-center">
            <div className="text-5xl">🎁</div>
            <h3 className="mt-4 font-display text-[20px] font-bold text-dark">
              No hay premios en esta categoría
            </h3>
            <p className="mt-2 text-body">
              Probá con otra categoría — estamos sumando premios nuevos cada semana.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((premio) => (
              <PrizeCardV2
                key={premio.id}
                premio={premio}
                balanceActual={balance}
              />
            ))}
          </div>
        )}
      </section>

      {!isLoggedIn ? (
        <section className="rounded-xl bg-hero-blue px-6 py-8 text-center text-white shadow-lg md:px-10 md:py-10">
          <h2 className="font-display text-[22px] font-extrabold md:text-[28px]">
            ¿Todavía no tenés Lukas?
          </h2>
          <p className="mt-2 text-white/85">
            Entrá y jugá torneos gratis con el bonus de bienvenida de 500 🪙.
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/auth/login?callbackUrl=/tienda"
              className="inline-block rounded-md bg-brand-gold px-6 py-3 font-bold text-dark shadow-gold-btn"
            >
              Iniciar sesión
            </a>
            <a
              href="/matches"
              className="inline-block rounded-md border border-white/30 px-6 py-3 font-bold text-white hover:bg-white/10"
            >
              Ver torneos
            </a>
          </div>
        </section>
      ) : (
        <section className="rounded-xl bg-hero-blue px-6 py-8 text-center text-white shadow-lg md:px-10 md:py-10">
          <h2 className="font-display text-[22px] font-extrabold md:text-[28px]">
            ¿Necesitás más Lukas?
          </h2>
          <p className="mt-2 text-white/85">
            Jugá torneos y ganá. Todos los ganadores reciben premios al toque.
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/matches"
              className="inline-block rounded-md bg-brand-gold px-6 py-3 font-bold text-dark shadow-gold-btn"
            >
              Ver partidos
            </a>
            <a
              href="/wallet"
              className="inline-block rounded-md border border-white/30 px-6 py-3 font-bold text-white hover:bg-white/10"
            >
              Comprar Lukas
            </a>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "gold" | "green" | "blue";
}) {
  const toneCls =
    tone === "gold"
      ? "text-brand-gold-dark"
      : tone === "green"
        ? "text-brand-green"
        : "text-brand-blue-main";
  return (
    <div className="rounded-md bg-card border border-light p-4">
      <div className="text-[12px] uppercase tracking-wide text-muted-d">
        {label}
      </div>
      <div className={`mt-1 font-display text-[24px] font-extrabold ${toneCls}`}>
        {value}
      </div>
    </div>
  );
}
