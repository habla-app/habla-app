"use client";
// SidebarBalanceWidget — widget "🪙 Tu balance" en la sidebar de /matches y /.
// Lote 6C: añade el patrón de subconjunto Lukas Juego + Lukas Premios.
//
// Hotfix #5 Bug #14: suscripción a useLukasStore para reflejar mutaciones
// sin esperar un full-refresh. SSR initialBalance para el primer paint.
// initialBalanceGanadas (SSR) para el subconjunto — solo cambia con premios
// de torneo (evento server-side); se actualiza en la siguiente navegación.

import Link from "next/link";
import { useEffect, useState } from "react";
import { BONUS_BIENVENIDA_LUKAS } from "@/lib/config/economia";
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  /** Balance total del SSR (session.user.balanceLukas). null si anónimo. */
  initialBalance: number | null;
  /** Lukas Premios (ganadas) del SSR — subconjunto canjeable. Lote 6C. */
  initialBalanceGanadas?: number;
}

export function SidebarBalanceWidget({ initialBalance, initialBalanceGanadas = 0 }: Props) {
  if (initialBalance === null) {
    return (
      <section className="overflow-hidden rounded-md border border-brand-gold/30 bg-card shadow-sm">
        <UnloggedBalance />
      </section>
    );
  }
  return (
    <section
      className="overflow-hidden rounded-md border-2 border-brand-gold/40 bg-gradient-to-br from-brand-gold-dim to-card shadow-sm"
      data-testid="sidebar-balance-widget"
    >
      <LoggedBalance
        initialBalance={initialBalance}
        initialBalanceGanadas={initialBalanceGanadas}
      />
    </section>
  );
}

function LoggedBalance({
  initialBalance,
  initialBalanceGanadas,
}: {
  initialBalance: number;
  initialBalanceGanadas: number;
}) {
  const storeBalance = useLukasStore((s) => s.balance);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const juego = mounted ? storeBalance : initialBalance;
  const premios = initialBalanceGanadas;

  return (
    <div className="px-5 py-5">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="text-[14px]">
          ⚽
        </span>
        <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-d">
          Lukas Juego
        </span>
      </div>
      <div
        className="font-display text-[52px] font-black leading-[0.95] tracking-tight text-brand-gold-dark"
        data-testid="sidebar-balance-amount"
      >
        {juego.toLocaleString("es-PE")}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-muted-d">
        Todo tu saldo · Para jugar y ganar
      </div>

      {/* Subconjunto Lukas Premios */}
      <div className="mt-3 flex items-center gap-2 rounded-sm border border-brand-green/25 bg-alert-success-bg px-3 py-2 text-[12px] font-semibold text-alert-success-text">
        <span aria-hidden className="text-[14px] leading-none">🏆</span>
        <span>
          <strong>{premios.toLocaleString("es-PE")}</strong>
          {premios === 1 ? " Luka Premio" : " Lukas Premios"} · canjeables en Tienda
        </span>
      </div>

      <Link
        href="/wallet"
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-brand-gold/40 bg-card/80 px-3 py-2.5 text-center text-[12px] font-bold text-brand-gold-dark transition-colors hover:border-brand-gold hover:bg-brand-gold hover:text-black"
      >
        Ver billetera →
      </Link>
    </div>
  );
}

function UnloggedBalance() {
  return (
    <div className="px-5 py-5 text-center">
      <div aria-hidden className="mb-2 text-[28px] leading-none">
        🔒
      </div>
      <p className="mb-0.5 text-[13px] font-bold text-dark">
        Inicia sesión para ver tu balance
      </p>
      <p className="mb-3.5 text-[11px] leading-snug text-muted-d">
        Regístrate y recibe {BONUS_BIENVENIDA_LUKAS} Lukas de bienvenida para tu
        primera combinada.
      </p>
      <Link
        href="/auth/signin?callbackUrl=/"
        className="block w-full rounded-sm bg-brand-gold px-2.5 py-2.5 text-[12px] font-bold text-black transition-colors hover:bg-brand-gold-light"
      >
        Entrar
      </Link>
    </div>
  );
}
