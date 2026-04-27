"use client";
// BalanceBadge — chip del header. Lote 6C: dos pills separadas en desktop
// con jerarquía visual clara: pill 1 (gold) muestra Lukas para jugar, pill
// 2 (lila) muestra Lukas canjeables. Mismo Link a /wallet en ambos casos
// para no introducir nueva funcionalidad.
//
// Mobile: una sola pill compacta con el total para no romper el header.
//
// Hotfix #4 Bug #7: suscripción a useLukasStore para reflejar mutaciones
// (inscripción/compra/canje) sin esperar un full-refresh.
// El total (Lukas Juego) siempre se lee del store post-mount.
// Lukas Premios usa initialBalanceGanadas (SSR) — solo cambia con premios
// de torneo, que son eventos server-side; se refresca en la siguiente
// navegación completa.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  /** Balance total del server (session.user.balanceLukas) para el primer paint. */
  initialBalance: number | null;
  /** Lukas Premios (ganadas) del SSR — subconjunto canjeable en /tienda. Lote 6C. */
  initialBalanceGanadas?: number;
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("es-PE");
}

export function BalanceBadge({ initialBalance, initialBalanceGanadas = 0 }: Props) {
  const storeBalance = useLukasStore((s) => s.balance);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const juego = mounted ? storeBalance : (initialBalance ?? 0);
  const premios = initialBalanceGanadas;

  return (
    <>
      {/* Mobile: una sola pill compacta con el total (ahorra espacio horizontal) */}
      <Link
        href="/wallet"
        data-testid="balance-badge"
        className="flex items-center gap-1.5 rounded-sm border border-brand-gold/25 bg-brand-gold/10 px-[13px] py-[7px] text-[13px] font-bold text-brand-gold transition-colors hover:bg-brand-gold/20 sm:hidden"
      >
        <span aria-hidden className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-gold text-[10px] font-black leading-none text-black">🪙</span>
        <span>{fmt(juego)}</span>
      </Link>

      {/* Desktop: dos pills separadas — gold (jugar) + lila (canjeables) */}
      <div className="hidden items-center gap-2 sm:flex" data-testid="balance-badge">
        <Link
          href="/wallet"
          data-testid="balance-pill-juego"
          className="flex items-center gap-2 rounded-sm border border-brand-gold/25 bg-brand-gold/10 px-3 py-1.5 leading-none text-brand-gold transition-colors hover:bg-brand-gold/20"
        >
          <span aria-hidden className="text-[14px] leading-none">🪙</span>
          <span className="flex flex-col items-start gap-[2px]">
            <span className="font-display text-[15px] font-extrabold leading-none">
              {fmt(juego)}
            </span>
            <span className="text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-brand-gold/70">
              Para jugar
            </span>
          </span>
        </Link>

        <Link
          href="/wallet"
          data-testid="balance-pill-canjeables"
          className="flex items-center gap-2 rounded-sm border border-accent-mundial/30 bg-accent-mundial/15 px-3 py-1.5 leading-none text-accent-mundial-bg transition-colors hover:bg-accent-mundial/25"
        >
          <span aria-hidden className="text-[14px] leading-none">🎁</span>
          <span className="flex flex-col items-start gap-[2px]">
            <span className="font-display text-[15px] font-extrabold leading-none">
              {fmt(premios)}
            </span>
            <span className="text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-accent-mundial-bg/70">
              Canjeables
            </span>
          </span>
        </Link>
      </div>
    </>
  );
}
