"use client";
// BalanceBadge — el chip del header que muestra "X Lukas". Client
// Component para poder leer `useLukasStore` y re-renderizar cuando el
// balance cambia tras una inscripción o compra. El NavBar padre es
// Server Component y le pasa `initialBalance` desde la sesión para
// evitar flicker durante el primer render (antes de que el
// LukasBalanceHydrator sincronice el store).
//
// Hotfix #4 Bug #7: antes el badge leía `session.user.balanceLukas`
// directamente en el NavBar — al mutar balance en el store post-
// inscripción, el header seguía mostrando el valor viejo hasta el
// próximo refresh duro. Ahora el badge se suscribe al store y
// refleja el balance actualizado de inmediato.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  /** Balance del server (session.user.balanceLukas) para el primer paint. */
  initialBalance: number | null;
}

function formatearLukas(balance: number): string {
  if (balance >= 1000) {
    return `${(balance / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return balance.toLocaleString("es-PE");
}

export function BalanceBadge({ initialBalance }: Props) {
  const storeBalance = useLukasStore((s) => s.balance);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pre-mount (primer paint): usa el valor SSR de la sesión.
  // Post-mount: usa el store (que ya fue hidratado por
  // LukasBalanceHydrator y muta tras cada inscripción/compra).
  const display = mounted ? storeBalance : (initialBalance ?? 0);

  return (
    <Link
      href="/wallet"
      data-testid="balance-badge"
      className="flex items-center gap-[7px] rounded-sm border border-brand-gold/25 bg-brand-gold/10 px-[13px] py-[7px] text-[13px] font-bold text-brand-gold transition-colors hover:bg-brand-gold/20"
    >
      <span
        aria-hidden
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-gold text-[10px] font-black leading-none text-black"
      >
        🪙
      </span>
      <span>{formatearLukas(display)} Lukas</span>
    </Link>
  );
}
