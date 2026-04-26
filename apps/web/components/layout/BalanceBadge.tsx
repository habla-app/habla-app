"use client";
// BalanceBadge — chip del header. Lote 6C: dos líneas en desktop mostrando
// Lukas Juego (total) + subset Lukas Premios (ganadas). En mobile solo el
// total para no romper el layout del header.
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
    <Link
      href="/wallet"
      data-testid="balance-badge"
      className="flex items-center gap-[7px] rounded-sm border border-brand-gold/25 bg-brand-gold/10 px-[13px] py-[7px] font-bold text-brand-gold transition-colors hover:bg-brand-gold/20"
    >
      {/* Mobile: solo el total en una línea */}
      <span className="flex items-center gap-1.5 text-[13px] sm:hidden">
        <span aria-hidden className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-gold text-[10px] font-black leading-none text-black">🪙</span>
        <span>{fmt(juego)}</span>
      </span>

      {/* Desktop: Lukas Juego + separador + Lukas Premios inline */}
      <span className="hidden items-center gap-2 text-[13px] sm:flex">
        <span className="flex items-center gap-1.5 leading-none">
          <span aria-hidden className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-gold text-[10px] font-black leading-none text-black">⚽</span>
          <span>{fmt(juego)}</span>
          <span className="font-normal opacity-60">Juego</span>
        </span>
        <span aria-hidden className="h-3 w-px rounded-full bg-brand-gold/40" />
        <span className="flex items-center gap-1 text-[11px] leading-none opacity-75">
          <span aria-hidden>🏆</span>
          <span>{fmt(premios)} Premios</span>
        </span>
      </span>
    </Link>
  );
}
