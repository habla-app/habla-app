"use client";
// Visual de los 4 packs (mockup `.pack-options .pack-card`). La compra real
// con Culqi/Yape se habilita con flag `PAGOS_HABILITADOS` (Lote 8). Mientras
// el flag esté OFF, el click solo muestra un toast y no inicia flujo de
// cobro.

import { useState } from "react";
import { PACKS_LUKAS, type PackLukasId } from "@/lib/constants/packs-lukas";

type Variant = "base" | "popular" | "best";

interface PackVisual {
  id: PackLukasId;
  emoji: string;
  variant: Variant;
  badge?: string;
}

const VISUALS: Record<PackLukasId, PackVisual> = {
  basic:  { id: "basic",  emoji: "🪙", variant: "base" },
  medium: { id: "medium", emoji: "💰", variant: "base" },
  large:  { id: "large",  emoji: "💎", variant: "popular", badge: "🔥 Más popular" },
  vip:    { id: "vip",    emoji: "👑", variant: "best",    badge: "⭐ Mejor valor" },
};

interface BuyPacksPlaceholderProps {
  /** Lote 8: si false, los packs muestran tooltip "Próximamente". */
  pagosHabilitados?: boolean;
}

export function BuyPacksPlaceholder({
  pagosHabilitados = false,
}: BuyPacksPlaceholderProps = {}) {
  const [selected, setSelected] = useState<PackLukasId | null>("large");
  const [toast, setToast] = useState<string | null>(null);

  const handleSelect = (pack: (typeof PACKS_LUKAS)[number]) => {
    setSelected(pack.id);
    if (!pagosHabilitados) {
      setToast(
        `Próximamente disponible. Estamos cerrando Culqi para habilitar la compra del pack ${pack.id}.`,
      );
      setTimeout(() => setToast(null), 4000);
    }
  };

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
        {PACKS_LUKAS.map((pack) => {
          const visual = VISUALS[pack.id];
          return (
            <PackCard
              key={pack.id}
              pack={pack}
              visual={visual}
              selected={selected === pack.id}
              disabled={!pagosHabilitados}
              onSelect={() => handleSelect(pack)}
            />
          );
        })}
      </div>

      {!pagosHabilitados && (
        <div className="mt-4 rounded-sm border border-alert-info-border bg-alert-info-bg px-4 py-3 text-[12px] leading-relaxed text-alert-info-text">
          <strong>Próximamente disponible.</strong> Estamos cerrando Culqi para
          habilitar la compra de Lukas con tarjeta y Yape.
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="mt-3 rounded-sm border border-alert-warning-border bg-alert-warning-bg px-4 py-3 text-[12px] text-alert-warning-text"
        >
          {toast}
        </div>
      )}
    </section>
  );
}

function PackCard({
  pack,
  visual,
  selected,
  disabled,
  onSelect,
}: {
  pack: { id: PackLukasId; soles: number; lukas: number; bonus: number };
  visual: PackVisual;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const variantClass =
    visual.variant === "popular"
      ? "border-brand-gold bg-gradient-to-br from-white to-[#FFFDF5]"
      : visual.variant === "best"
        ? "border-brand-green bg-gradient-to-br from-white to-[#F0FDF4]"
        : "border-light";
  const selectedClass = selected
    ? "ring-2 ring-brand-gold ring-offset-2 ring-offset-card"
    : "";
  const badgeClass =
    visual.variant === "popular"
      ? "bg-brand-gold text-black"
      : visual.variant === "best"
        ? "bg-brand-green text-black"
        : "";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={disabled ? "Próximamente disponible" : undefined}
      className={`relative rounded-md border-2 p-5 pt-6 text-center transition hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-md ${variantClass} ${selectedClass} ${disabled ? "opacity-90" : ""}`}
    >
      {visual.badge ? (
        <span
          className={`absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] ${badgeClass}`}
        >
          {visual.badge}
        </span>
      ) : null}
      <div aria-hidden className="mb-1.5 text-[28px] leading-none">
        {visual.emoji}
      </div>
      <div className="font-display text-[28px] font-black leading-none text-brand-gold-dark">
        {pack.lukas}
      </div>
      {pack.bonus > 0 ? (
        <div className="mt-1.5 inline-block rounded-full bg-alert-success-bg px-2 py-0.5 text-[10px] font-bold text-alert-success-text">
          +{pack.bonus} bonus
        </div>
      ) : null}
      <div className="mt-2.5 border-t border-light pt-2.5 font-display text-base font-bold text-dark">
        S/ {pack.soles}
      </div>
      <div className="mt-1 text-[10px] text-muted-d">Tarjeta o Yape</div>
    </button>
  );
}
