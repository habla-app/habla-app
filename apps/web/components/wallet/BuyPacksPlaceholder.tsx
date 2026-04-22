"use client";
// Visual de los 4 packs (mockup `.pack-options .pack-card`). La compra real
// con Culqi/Yape llega en Sub-Sprint 2 — click muestra un toast "Próximamente".
// Deja la UI lista, basta con cablear el handler en SS2.

import { useState } from "react";

interface Pack {
  id: "pack20" | "pack50" | "pack100" | "pack250";
  emoji: string;
  coins: number;
  bonus: number;
  price: number;
  variant: "base" | "popular" | "best";
  badge?: string;
}

const PACKS: ReadonlyArray<Pack> = [
  { id: "pack20", emoji: "🪙", coins: 20, bonus: 0, price: 20, variant: "base" },
  { id: "pack50", emoji: "💰", coins: 50, bonus: 5, price: 50, variant: "base" },
  {
    id: "pack100",
    emoji: "💎",
    coins: 100,
    bonus: 15,
    price: 100,
    variant: "popular",
    badge: "🔥 Más popular",
  },
  {
    id: "pack250",
    emoji: "👑",
    coins: 250,
    bonus: 50,
    price: 250,
    variant: "best",
    badge: "⭐ Mejor valor",
  },
];

export function BuyPacksPlaceholder() {
  const [selected, setSelected] = useState<Pack["id"] | null>("pack100");

  return (
    <section className="mb-5 rounded-md border border-light bg-card p-6 shadow-sm">
      <header className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-brand-gold text-[22px] shadow-gold">
          <span aria-hidden>💳</span>
        </div>
        <div>
          <h2 className="font-display text-[22px] font-black uppercase leading-none text-dark">
            Comprar más Lukas
          </h2>
          <div className="mt-0.5 text-xs text-muted-d">
            Paga con tarjeta o Yape · 1 Luka = S/ 1
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {PACKS.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            selected={selected === pack.id}
            onSelect={() => setSelected(pack.id)}
          />
        ))}
      </div>

      <div className="mt-4 rounded-sm border border-alert-info-border bg-alert-info-bg px-4 py-3 text-[12px] leading-relaxed text-alert-info-text">
        <strong>Integración en progreso.</strong> Estamos cerrando Culqi para
        habilitar la compra de Lukas con tarjeta y Yape. Muy pronto.
      </div>
    </section>
  );
}

function PackCard({
  pack,
  selected,
  onSelect,
}: {
  pack: Pack;
  selected: boolean;
  onSelect: () => void;
}) {
  const variantClass =
    pack.variant === "popular"
      ? "border-brand-gold bg-gradient-to-br from-white to-[#FFFDF5]"
      : pack.variant === "best"
        ? "border-brand-green bg-gradient-to-br from-white to-[#F0FDF4]"
        : "border-light";
  const selectedClass = selected
    ? "ring-2 ring-brand-gold ring-offset-2 ring-offset-card"
    : "";
  const badgeClass =
    pack.variant === "popular"
      ? "bg-brand-gold text-black"
      : pack.variant === "best"
        ? "bg-brand-green text-black"
        : "";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative rounded-md border-2 p-5 pt-6 text-center transition hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-md ${variantClass} ${selectedClass}`}
    >
      {pack.badge ? (
        <span
          className={`absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] ${badgeClass}`}
        >
          {pack.badge}
        </span>
      ) : null}
      <div aria-hidden className="mb-1.5 text-[28px] leading-none">
        {pack.emoji}
      </div>
      <div className="font-display text-[28px] font-black leading-none text-brand-gold-dark">
        {pack.coins}
      </div>
      {pack.bonus > 0 ? (
        <div className="mt-1.5 inline-block rounded-full bg-alert-success-bg px-2 py-0.5 text-[10px] font-bold text-alert-success-text">
          +{pack.bonus} bonus
        </div>
      ) : null}
      <div className="mt-2.5 border-t border-light pt-2.5 font-display text-base font-bold text-dark">
        S/ {pack.price}
      </div>
      <div className="mt-1 text-[10px] text-muted-d">Tarjeta o Yape</div>
    </button>
  );
}
