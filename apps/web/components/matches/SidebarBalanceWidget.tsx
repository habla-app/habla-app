"use client";
// SidebarBalanceWidget — widget "🪙 Tus Lukas" en la sidebar de /matches y /.
// Lote 6C-fix7: simplificado a un solo balance con label "Tus Lukas".
// Quitamos el chip de Lukas Premios (queda solo en /wallet y BalanceBadge).
//
// Estilo dark + gold (alineado con balance-hero-v2 del mockup): fondo
// blue-dark, barra shimmer dorada superior, número en gold gigante. Destaca
// del resto de widgets informativos (live, pozos, top, cómo se paga).
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
      className="relative overflow-hidden rounded-md bg-dark-surface shadow-md"
      data-testid="sidebar-balance-widget"
    >
      {/* Barra shimmer dorada superior (mismo patrón que balance-hero-v2). */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[4px] bg-gold-shimmer bg-[length:200%_100%] animate-shimmer"
      />
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
    <div className="px-5 pb-5 pt-6">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="text-[14px]">
          🪙
        </span>
        <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-gold/80">
          Tus Lukas
        </span>
      </div>
      <div
        className="font-display text-[52px] font-black leading-[0.95] tracking-tight text-brand-gold [text-shadow:0_4px_20px_rgba(255,184,0,0.25)]"
        data-testid="sidebar-balance-amount"
      >
        {lukas.toLocaleString("es-PE")}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-brand-gold/60">
        Todas tus Lukas disponibles para jugar
      </div>

      <Link
        href="/wallet"
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-sm bg-brand-gold px-3 py-2.5 text-center text-[12px] font-bold text-black transition-colors hover:bg-brand-gold-light"
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
