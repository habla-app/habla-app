"use client";
// Hero del /wallet. Mockup balance-hero-v2: gradient azul, shimmer dorado
// en borde superior, emoji 🪙 gigante rotado al fondo, balance en display
// 80px, línea sub "créditos canjeables" y chip "⏳ X Lukas vencen el …".
//
// Mounted-guard con useLukasStore → se hidrata a balance real post-mount
// para reflejar cambios por inscripción/canje/compra sin refresh.

import { useEffect, useState } from "react";
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  initialBalance: number;
  proxVencimiento?: {
    lukas: number;
    fecha: Date;
  } | null;
}

export function WalletBalanceHero({ initialBalance, proxVencimiento }: Props) {
  const storeBalance = useLukasStore((s) => s.balance);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const display = mounted ? storeBalance : initialBalance;

  return (
    <section
      className="relative mb-5 overflow-hidden rounded-lg bg-hero-blue p-7 shadow-lg"
      data-testid="wallet-balance-hero"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[5px] bg-gold-shimmer bg-[length:200%_100%] animate-shimmer"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 rotate-[-15deg] text-[220px] leading-none opacity-[0.06]"
      >
        🪙
      </div>

      <div className="relative">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">
          Tu balance actual
        </div>
        <div
          className="mt-1.5 font-display text-[64px] font-black leading-none text-brand-gold [text-shadow:0_4px_20px_rgba(255,184,0,0.3)] sm:text-[80px]"
          data-testid="wallet-balance-amount"
        >
          {display.toLocaleString("es-PE")}{" "}
          <span aria-hidden className="align-middle text-[0.6em]">
            🪙
          </span>
        </div>
        <div className="mt-2 text-[13px] text-white/75">
          Créditos para canjear premios en la Tienda
        </div>
        {proxVencimiento ? (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/15 px-3 py-1.5 text-[11px] font-semibold text-brand-gold-light">
            <span aria-hidden>⏳</span>
            {proxVencimiento.lukas.toLocaleString("es-PE")} Lukas vencen el{" "}
            {formatVencimiento(proxVencimiento.fecha)}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatVencimiento(fecha: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(fecha);
}
