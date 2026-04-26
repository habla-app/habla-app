"use client";
// Hero del /wallet. Mockup balance-hero-v2: gradient azul oscuro (bg-hero-blue,
// linear-gradient(135deg, #0052CC → #001050)), shimmer dorado en borde superior,
// emoji 🪙 gigante rotado al fondo.
//
// Lote 6C-fix7: layout en dos columnas separadas por línea sutil — izquierda
// el balance total ("Tus Lukas"), derecha el subconjunto canjeable
// ("Lukas Premios"). Mismo formato (número + 🪙) en ambos lados, premios un
// poco más pequeño para indicar visualmente que es subgrupo. Sin emoji ⚽.

import { useEffect, useState } from "react";
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  initialBalance: number;
  /** Lukas Premios (balanceGanadas) del SSR — subconjunto canjeable. */
  initialBalanceGanadas: number;
  proxVencimiento?: {
    lukas: number;
    /** Serializada como string ISO al cruzar server→client. */
    fecha: Date | string;
  } | null;
}

export function WalletBalanceHero({
  initialBalance,
  initialBalanceGanadas,
  proxVencimiento,
}: Props) {
  const storeBalance = useLukasStore((s) => s.balance);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const total = mounted ? storeBalance : initialBalance;
  const premios = initialBalanceGanadas;

  return (
    <section
      className="relative mb-5 overflow-hidden rounded-lg bg-hero-blue p-7 shadow-lg"
      data-testid="wallet-balance-hero"
    >
      {/* Barra shimmer dorada superior */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[5px] bg-gold-shimmer bg-[length:200%_100%] animate-shimmer"
      />
      {/* Emoji decorativo de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 rotate-[-15deg] text-[220px] leading-none opacity-[0.06]"
      >
        🪙
      </div>

      {/* Layout: 2 columnas separadas por línea sutil. Mobile: stack vertical */}
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* Lado izquierdo — Tus Lukas (total) */}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">
            Tus Lukas
          </div>
          <div
            className="mt-1.5 font-display text-[52px] font-black leading-none text-brand-gold [text-shadow:0_4px_20px_rgba(255,184,0,0.3)] sm:text-[64px]"
            data-testid="wallet-balance-amount"
          >
            {total.toLocaleString("es-PE")}{" "}
            <span aria-hidden className="align-middle text-[0.6em]">
              🪙
            </span>
          </div>
          <div className="mt-1.5 text-[12px] font-semibold text-white/80">
            Todas tus Lukas disponibles para jugar
          </div>
        </div>

        {/* Línea sutil divisora — vertical en desktop, horizontal en mobile */}
        <div
          aria-hidden
          className="h-px w-full bg-white/15 sm:h-24 sm:w-px sm:flex-shrink-0"
        />

        {/* Lado derecho — Lukas Premios (subconjunto canjeable, más pequeño) */}
        <div className="flex-shrink-0 min-w-0 sm:w-[42%]">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-green/90">
            Lukas Premios
          </div>
          <div
            className="mt-1.5 font-display text-[36px] font-black leading-none text-brand-green [text-shadow:0_4px_20px_rgba(0,214,143,0.25)] sm:text-[44px]"
            data-testid="wallet-balance-premios"
          >
            {premios.toLocaleString("es-PE")}{" "}
            <span aria-hidden className="align-middle text-[0.6em]">
              🪙
            </span>
          </div>
          <div className="mt-1.5 text-[12px] font-semibold text-white/80">
            Disponibles para canjear en Premios
          </div>
        </div>
      </div>

      {proxVencimiento ? (
        <div className="relative mt-4 inline-flex items-center gap-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/15 px-3 py-1.5 text-[11px] font-semibold text-brand-gold-light">
          <span aria-hidden>⏳</span>
          {proxVencimiento.lukas.toLocaleString("es-PE")} Lukas vencen el{" "}
          {formatVencimiento(proxVencimiento.fecha)}
        </div>
      ) : null}
    </section>
  );
}

function formatVencimiento(fecha: Date | string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(new Date(fecha));
}
