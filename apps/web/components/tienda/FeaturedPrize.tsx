// FeaturedPrize — hero card para el premio destacado. Sub-Sprint 6.
"use client";

import { useState } from "react";
import type { PremioDTO } from "@/lib/services/premios.service";
import { CanjearModal } from "./CanjearModal";

interface FeaturedPrizeProps {
  premio: PremioDTO;
  balanceActual: number;
}

export function FeaturedPrize({ premio, balanceActual }: FeaturedPrizeProps) {
  const [open, setOpen] = useState(false);
  const afordable = balanceActual >= premio.costeLukas;
  const agotado = premio.stock <= 0;

  return (
    <>
      <div className="relative overflow-hidden rounded-xl bg-hero-blue px-6 py-8 text-white shadow-lg md:px-10 md:py-10">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 animate-shimmer bg-gold-shimmer bg-[length:200%_100%]"
        />
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-gold/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-gold-light">
              ⭐ Destacado
            </span>
            <h2 className="mt-3 font-display text-[28px] font-extrabold md:text-[36px]">
              {premio.nombre}
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/85 md:text-[15px]">
              {premio.descripcion}
            </p>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-display text-[40px] font-extrabold text-brand-gold md:text-[48px]">
                {premio.costeLukas}
              </span>
              <span className="text-2xl">🪙</span>
              {premio.stock > 0 && premio.stock <= 10 && (
                <span className="ml-2 rounded-full bg-urgent-critical px-3 py-1 text-[11px] font-bold">
                  Quedan {premio.stock}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-white/10 text-7xl backdrop-blur-sm">
              {premio.imagen ?? "🎁"}
            </div>
            {agotado ? (
              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-md bg-white/10 px-6 py-3 font-bold text-white/50"
              >
                Agotado
              </button>
            ) : afordable ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full rounded-md bg-brand-gold px-6 py-3 font-bold text-dark shadow-gold-cta transition-colors hover:bg-brand-gold-light"
              >
                ✓ Canjear ahora
              </button>
            ) : (
              <div className="w-full rounded-md border border-white/20 px-6 py-3 text-center text-[13px] text-white/80">
                Te faltan {premio.costeLukas - balanceActual} 🪙
              </div>
            )}
          </div>
        </div>
      </div>

      {open && (
        <CanjearModal
          premio={premio}
          balanceActual={balanceActual}
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      )}
    </>
  );
}
