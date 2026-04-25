"use client";
// SidebarBalanceWidget — migra el widget "🪙 Tu balance" de
// MatchesSidebar al store (useLukasStore) — Hotfix #5 Bug #14.
//
// Antes MatchesSidebar era Server Component que leía
// `session.user.balanceLukas` y pintaba el monto directamente. Tras una
// inscripción el store se actualizaba (setBalance tras respuesta 200)
// pero este widget seguía mostrando el valor SSR hasta el próximo
// full-refresh de la página. Ahora el widget es client-side con el
// mismo patrón que `BalanceBadge` y `BalancePill`: `initialBalance` del
// SSR para evitar flicker + subscripción al store post-mount.
//
// Props:
//   - balance del server (o null si no hay sesión)
// Comportamiento:
//   - null → renderiza el card "inicia sesión"
//   - number → renderiza hero con balance live del store

import Link from "next/link";
import { useEffect, useState } from "react";
import { BONUS_BIENVENIDA_LUKAS } from "@/lib/config/economia";
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  /** Balance del SSR (session.user.balanceLukas). null si anónimo. */
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
  // Mismo patrón que BalanceBadge / BalancePill: SSR pre-mount para
  // evitar flicker, store post-mount para reflejar mutaciones.
  const amount = mounted ? storeBalance : initialBalance;

  return (
    <div className="px-5 py-5">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="text-[14px]">
          🪙
        </span>
        <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-d">
          Tu balance
        </span>
      </div>
      <div
        className="font-display text-[52px] font-black leading-[0.95] tracking-tight text-brand-gold-dark"
        data-testid="sidebar-balance-amount"
      >
        {amount.toLocaleString("es-PE")}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-muted-d">
        Lukas · ≈ S/ {amount.toLocaleString("es-PE")} en créditos
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
