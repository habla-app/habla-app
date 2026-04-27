"use client";
// SidebarBalanceWidget — widget "🪙 Tus Lukas" en la sidebar de /matches y /.
// Lote 6C-fix7: simplificado a un solo balance con label "Tus Lukas".
// Quitamos el chip de Lukas Premios (queda solo en /wallet y BalanceBadge).
//
// Estructura: header homologado al resto de widgets de la sidebar (live,
// pozos, top — todos con `text-[13px] font-extrabold uppercase` y padding
// `px-3.5 py-3`). El distintivo del balance está en el body — número grande
// en gold con la moneda 🪙 a la derecha.
//
// Fondo idéntico al WalletBalanceHero pero a escala chica: gradient
// `bg-hero-blue` (135deg, blue-main → blue-dark) + barra shimmer dorada
// superior + emoji 🪙 gigante rotado al fondo (escalado al tamaño del
// widget). Así el sidebar visualmente "rima" con el hero del wallet.
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
      className="relative overflow-hidden rounded-md bg-hero-blue shadow-md"
      data-testid="sidebar-balance-widget"
    >
      {/* Barra shimmer dorada superior — hint visual del valor (4px,
          un poco más fina que los 5px del WalletBalanceHero porque el
          widget es más chico). */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-[4px] bg-gold-shimmer bg-[length:200%_100%] animate-shimmer"
      />
      {/* Emoji 🪙 gigante rotado al fondo — mismo recurso decorativo
          del WalletBalanceHero, escalado al tamaño del sidebar widget
          (140px vs 220px del hero). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 rotate-[-15deg] text-[140px] leading-none opacity-[0.06]"
      >
        🪙
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
  const lukas = mounted ? storeBalance : initialBalance;

  return (
    <div className="relative">
      {/* Header homologado al resto de widgets (live/pozos/top). Mismo
          font-size, weight, tracking, padding. Sin border-bottom porque el
          fondo dark del body es continuo. */}
      <div className="flex items-center gap-2 px-3.5 pb-2.5 pt-4">
        <span aria-hidden className="text-[15px]">
          🪙
        </span>
        <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-brand-gold">
          Tus Lukas
        </span>
      </div>

      {/* Body — número grande con 🪙 al lado derecho. */}
      <div className="px-3.5 pb-4">
        <div
          className="flex items-baseline gap-2 font-display text-[52px] font-black leading-[0.95] tracking-tight text-brand-gold [text-shadow:0_4px_20px_rgba(255,184,0,0.25)]"
          data-testid="sidebar-balance-amount"
        >
          <span>{lukas.toLocaleString("es-PE")}</span>
          <span aria-hidden className="text-[34px] leading-none">
            🪙
          </span>
        </div>
        <div className="mt-1.5 text-[11px] font-semibold text-brand-gold/60">
          Todas tus Lukas disponibles para jugar
        </div>

        <Link
          href="/wallet"
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-sm bg-brand-gold px-3 py-2.5 text-center text-[12px] font-bold text-black transition-colors hover:bg-brand-gold-light"
        >
          Ver billetera →
        </Link>
      </div>
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
