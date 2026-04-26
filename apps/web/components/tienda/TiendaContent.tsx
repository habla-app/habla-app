"use client";
// TiendaContent — orquesta /tienda (Sub-Sprint 6).
// Lote 6B: stats muestra balance Ganados (canjeables) en lugar del total.
// Progress bars y affordability ahora usan balanceGanadas.
// ModalSinGanadas se abre cuando la API rechaza por BALANCE_INSUFICIENTE.

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

  const canjeablesAhora = useMemo(
    () => premios.filter((p) => p.stock > 0 && ganadas >= p.costeLukas).length,
    [premios, ganadas],
  );

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

      {isLoggedIn ? (
        <section className="mb-4 grid grid-cols-3 gap-3">
          {/* Canjeables (Ganados) — solo los ganados en torneos sirven para canjear */}
          <div
            className="flex items-center gap-3 rounded-md border border-light bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            title="Solo los Lukas que ganaste en torneos se pueden canjear"
          >
            <div
              aria-hidden
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm border border-pred-correct/30 bg-alert-success-bg text-[22px]"
            >
              🏆
            </div>
            <div className="min-w-0">
              <div className="font-display text-[22px] font-black leading-none text-alert-success-text">
                {ganadas.toLocaleString("es-PE")}
              </div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
                Canjeables
              </div>
            </div>
          </div>
          <ShopStat
            icon="✓"
            iconBg="avail"
            color="green"
            value={canjeablesAhora.toString()}
            label="Disp. ahora"
          />
          <ShopStat
            icon="🎁"
            iconBg="redeemed"
            color="purple"
            value={totalCanjeados.toString()}
            label="Ya canjeados"
          />
        </section>
      ) : null}

      <div className="mb-6 flex items-start gap-2.5 rounded-sm border border-l-4 border-brand-gold/30 border-l-brand-gold bg-[#FFFBF5] px-3.5 py-3 text-xs leading-relaxed text-body">
        <span aria-hidden className="flex-shrink-0 text-base">
          💡
        </span>
        <div>
          Los <strong className="text-brand-gold-dark">Lukas</strong> son
          créditos para canjear estos premios. Se ganan jugando torneos o
          comprándolos en la Billetera —{" "}
          <strong className="text-brand-gold-dark">
            no son convertibles a efectivo
          </strong>
          .
        </div>
      </div>

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

function ShopStat({
  icon,
  iconBg,
  color,
  value,
  label,
}: {
  icon: string;
  iconBg: "bal" | "avail" | "redeemed";
  color: "gold" | "green" | "purple";
  value: string;
  label: string;
}) {
  const iconBgClass =
    iconBg === "bal"
      ? "bg-brand-gold-dim border border-brand-gold/30"
      : iconBg === "avail"
        ? "bg-alert-success-bg border border-pred-correct/30"
        : "bg-accent-champions-bg border border-alert-info-border";
  const colorClass =
    color === "gold"
      ? "text-brand-gold-dark"
      : color === "green"
        ? "text-alert-success-text"
        : "text-accent-mundial-dark";
  return (
    <div className="flex items-center gap-3 rounded-md border border-light bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div
        aria-hidden
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm text-[22px] ${iconBgClass}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className={`font-display text-[22px] font-black leading-none ${colorClass}`}
        >
          {value}
        </div>
        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
          {label}
        </div>
      </div>
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
