"use client";
// WalletBalanceHero — hero del /wallet con el monto gigante. Hotfix #5
// Bug #14: antes la página server-side leía `session.user.balanceLukas`
// y lo pintaba, quedando stale tras una inscripción hasta refresh.
// Ahora es Client Component con el mismo patrón mounted-guard que
// BalanceBadge / BalancePill / SidebarBalanceWidget.

import { useEffect, useState } from "react";
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  /** Balance del SSR (session.user.balanceLukas). */
  initialBalance: number;
}

export function WalletBalanceHero({ initialBalance }: Props) {
  const storeBalance = useLukasStore((s) => s.balance);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const display = mounted ? storeBalance : initialBalance;

  return (
    <section
      className="overflow-hidden rounded-lg border border-dark-border bg-hero-blue p-7 text-center shadow-md"
      data-testid="wallet-balance-hero"
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">
        Tu balance
      </div>
      <div
        className="mt-2 font-display text-[64px] font-black leading-none text-brand-gold"
        data-testid="wallet-balance-amount"
      >
        {display.toLocaleString("es-PE")} <span aria-hidden>🪙</span>
      </div>
      <div className="mt-2 text-xs text-white/60">
        1 Luka = S/ 1 · No son retirables como efectivo
      </div>
    </section>
  );
}
