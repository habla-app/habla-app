"use client";
// SidebarBalanceWidget — widget "🪙 Tus Lukas" en la sidebar de /matches y /.
// Lote 6C-fix7: simplificado a un solo balance con label "Tus Lukas".
// Quitamos el chip de Lukas Premios (queda solo en /wallet y BalanceBadge).
//
// Hotfix #5 Bug #14: suscripción a useLukasStore para reflejar mutaciones
// sin esperar un full-refresh. SSR initialBalance para el primer paint.

import Link from "next/link";
import { useEffect, useState } from "react";
import { BONUS_BIENVENIDA_LUKAS } from "@/lib/config/economia";
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  /** Balance total del SSR (session.user.balanceLukas). null si anónimo. */
  initialBalance: number | null;
}

export function SidebarBalanceWidget({ initialBalance }: Props) {
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
      <LoggedBalance initialBalance={initialBalance} />
    </section>
  );
}

function LoggedBalance({ initialBalance }: { initialBalance: number }) {
  const storeBalance = useLukasStore((s) => s.balance);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const lukas = mounted ? storeBalance : initialBalance;

  return (
    <div className="px-5 py-5">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="text-[14px]">
          🪙
        </span>
        <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-d">
          Tus Lukas
        </span>
      </div>
      <div
        className="font-display text-[52px] font-black leading-[0.95] tracking-tight text-brand-gold-dark"
        data-testid="sidebar-balance-amount"
      >
        {lukas.toLocaleString("es-PE")}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-muted-d">
        Todas tus Lukas disponibles para jugar
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
