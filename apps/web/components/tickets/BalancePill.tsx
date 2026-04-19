"use client";
// BalancePill — pill del stats-summary de /mis-combinadas que muestra
// el balance ACTUAL de Lukas del usuario (absoluto), no el delta neto
// de la vida del torneo.
//
// Hotfix #4 Bug #7: antes el 4to stats-pill mostraba `stats.neto`
// (sum(premioLukas - entradaLukas) acumulado) bajo el label "Balance
// neto". Para un usuario recién inscrito en un torneo de 5 Lukas, esto
// daba "-5 🪙" porque aún no había ganado nada — visualmente parecía
// que el balance global era negativo. Ahora la pill lee del
// `useLukasStore` (fuente de verdad cross-página hidratada por
// LukasBalanceHydrator al mount del layout) y muestra el balance real.

import { useEffect, useState } from "react";
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  /** Balance del server (SSR) para evitar flicker en el primer paint. */
  initialBalance: number;
}

export function BalancePill({ initialBalance }: Props) {
  const storeBalance = useLukasStore((s) => s.balance);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mismo pattern que BalanceBadge: SSR value pre-mount, store post-mount.
  // Así evitamos el flash de "0 🪙" antes de que el LukasBalanceHydrator
  // corra su efecto inicial y propague la sesión al store.
  const display = mounted ? storeBalance : initialBalance;

  return (
    <div
      className="rounded-md border border-light bg-card px-4 py-3 shadow-sm"
      data-testid="balance-pill"
    >
      <div aria-hidden className="mb-1 text-[22px] leading-none">
        💰
      </div>
      <div className="font-display text-[26px] font-black leading-none text-brand-gold-dark">
        {display.toLocaleString("es-PE")} 🪙
      </div>
      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-d">
        Balance
      </div>
    </div>
  );
}
