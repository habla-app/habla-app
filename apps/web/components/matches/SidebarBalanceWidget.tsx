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
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  /** Balance del SSR (session.user.balanceLukas). null si anónimo. */
  initialBalance: number | null;
}

export function SidebarBalanceWidget({ initialBalance }: Props) {
  if (initialBalance === null) {
    return (
      <section className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-light px-3.5 py-3">
          <span aria-hidden className="text-[15px]">
            🪙
          </span>
          <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-dark">
            Tu balance
          </span>
        </div>
        <UnloggedBalance />
      </section>
    );
  }
  return (
    <section
      className="overflow-hidden rounded-md border border-light bg-card shadow-sm"
      data-testid="sidebar-balance-widget"
    >
      <div className="flex items-center gap-2 border-b border-light px-3.5 py-3">
        <span aria-hidden className="text-[15px]">
          🪙
        </span>
        <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-dark">
          Tu balance
        </span>
      </div>
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
    <div className="p-[18px] text-center">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-d">
        Disponible
      </div>
      <div
        className="font-display text-[40px] font-black leading-none text-brand-gold-dark"
        data-testid="sidebar-balance-amount"
      >
        {amount.toLocaleString("es-PE")}
      </div>
      <div className="mt-1 text-[11px] text-muted-d">
        ≈ S/ {amount.toLocaleString("es-PE")} en créditos
      </div>
      <div className="mt-3.5 flex gap-2">
        <Link
          href="/wallet"
          className="flex-1 rounded-sm bg-brand-gold px-2.5 py-2.5 text-center text-[12px] font-bold text-black transition-colors hover:bg-brand-gold-light"
        >
          💳 Comprar
        </Link>
        <Link
          href="/tienda"
          className="flex-1 rounded-sm border border-light bg-subtle px-2.5 py-2.5 text-center text-[12px] font-bold text-dark transition-colors hover:border-brand-gold"
        >
          🎁 Tienda
        </Link>
      </div>
    </div>
  );
}

function UnloggedBalance() {
  return (
    <div className="p-[18px] text-center">
      <div aria-hidden className="mb-2 text-[28px] leading-none">
        🔒
      </div>
      <p className="mb-0.5 text-[13px] font-bold text-dark">
        Inicia sesión para ver tu balance
      </p>
      <p className="mb-3.5 text-[11px] leading-snug text-muted-d">
        Regístrate y recibe 500 Lukas de bienvenida para tu primera
        combinada.
      </p>
      <Link
        href="/auth/login?callbackUrl=/"
        className="block w-full rounded-sm bg-brand-gold px-2.5 py-2.5 text-[12px] font-bold text-black transition-colors hover:bg-brand-gold-light"
      >
        Entrar
      </Link>
    </div>
  );
}
