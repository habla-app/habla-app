"use client";

// StickyPremiumCTA — sticky bottom CTA específico de la landing /premium
// (Lote D). Spec: docs/ux-spec/04-pista-usuario-premium/premium-landing.spec.md.
//
// Sticky encima del BottomNav del shell público. Contiene un único CTA
// dorado prominente. Click dispara `premium_checkout_iniciado` antes de
// navegar.

import Link from "next/link";
import { track } from "@/lib/analytics";
import type { PlanKey } from "@/lib/premium-planes";

interface Props {
  href: string;
  label: string;
  plan: PlanKey;
  pagosDisponibles: boolean;
}

export function StickyPremiumCTA({
  href,
  label,
  plan,
  pagosDisponibles,
}: Props) {
  const handleClick = () => {
    if (pagosDisponibles) {
      track("premium_checkout_iniciado", { plan, source: "premium-landing" });
    } else {
      track("premium_waitlist_iniciado", { plan, source: "premium-landing" });
    }
  };

  return (
    <div
      role="region"
      aria-label="Suscribirme a Premium"
      className="sticky bottom-[64px] z-sticky border-t border-light bg-card px-3.5 py-3 shadow-nav-top lg:bottom-4"
    >
      <Link
        href={href}
        onClick={handleClick}
        className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-premium-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light"
      >
        {label}
      </Link>
    </div>
  );
}
