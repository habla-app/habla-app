"use client";
// Hero del /wallet. Mockup balance-hero-v2: gradient azul oscuro (bg-hero-blue,
// corregido en Lote 6C a linear-gradient(135deg, #0052CC → #001050)), shimmer
// dorado en borde superior, emoji 🪙 gigante rotado al fondo.
//
// Lote 6C: muestra el patrón de subconjunto Lukas Juego + Lukas Premios.
// El total (Lukas Juego) se toma del store post-mount para reflejar mutaciones
// en tiempo real. Lukas Premios usa initialBalanceGanadas (SSR).

import { useEffect, useState } from "react";
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  initialBalance: number;
  /** Lukas Premios (balanceGanadas) del SSR — subconjunto canjeable. Lote 6C. */
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
  const juego = mounted ? storeBalance : initialBalance;
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

      <div className="relative">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">
          Tu balance actual
        </div>

        {/* Lukas Juego — monto principal */}
        <div
          className="mt-1.5 font-display text-[64px] font-black leading-none text-brand-gold [text-shadow:0_4px_20px_rgba(255,184,0,0.3)] sm:text-[80px]"
          data-testid="wallet-balance-amount"
        >
          <span aria-hidden className="mr-2 text-[0.55em]">⚽</span>
          {juego.toLocaleString("es-PE")}{" "}
          <span aria-hidden className="align-middle text-[0.6em]">
            🪙
          </span>
        </div>
        <div className="mt-1.5 text-[13px] font-semibold text-white/80">
          Lukas Juego · Para jugar y ganar
        </div>

        {/* Subconjunto Lukas Premios */}
        <div className="mt-3 inline-flex items-center gap-2 rounded-sm border border-brand-green/30 bg-white/10 px-3 py-2 text-[13px] font-semibold text-white/90">
          <span aria-hidden>↳ 🏆</span>
          <span>
            <strong className="text-brand-green">{premios.toLocaleString("es-PE")}</strong>
            {" "}son Lukas Premios · canjeables en Tienda
          </span>
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

function formatVencimiento(fecha: Date | string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(new Date(fecha));
}
