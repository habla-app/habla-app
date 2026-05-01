// PremiumStatusCard — estado Premium del usuario en /perfil (Lote C v3.1).
// Spec: docs/ux-spec/03-pista-usuario-autenticada/perfil.spec.md.
//
// Tres estados:
//   - No suscriptor       → card oscura premium-card-gradient + CTA
//                           "⚡ Probar 7 días gratis" → /premium
//   - Suscriptor activo   → card oscura con plan + próximo cobro + CTA
//                           "Gestionar →" → /premium/mi-suscripcion
//   - Suscriptor cancelando → card warn con fecha de fin + CTA
//                           "Reactivar →"
//
// Lote E reemplaza el `estado=null` por el modelo `Suscripcion`.

import Link from "next/link";
import type { EstadoPremium } from "@/lib/services/suscripciones.service";

const FMT_DIA_MES = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  timeZone: "America/Lima",
});

interface PremiumStatusCardProps {
  estado: EstadoPremium | null;
}

export function PremiumStatusCard({ estado }: PremiumStatusCardProps) {
  if (!estado) {
    return (
      <Link
        href="/premium"
        className="group mx-4 mt-1 block rounded-md border border-premium-border bg-premium-card-gradient px-4 py-4 text-premium-text-on-dark shadow-premium-card transition-all hover:border-brand-gold/60 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-brand-gold text-[22px] text-brand-blue-dark"
          >
            💎
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-display-xs font-bold uppercase">
              Probar Premium 7 días gratis
            </p>
            <p className="text-body-xs text-premium-text-muted-on-dark">
              Picks 1:1 vía WhatsApp + alertas en vivo
            </p>
          </div>
          <span className="rounded-sm bg-brand-gold px-3 py-1.5 text-label-md font-bold text-brand-blue-dark transition-transform group-hover:translate-x-0.5">
            Probar
          </span>
        </div>
      </Link>
    );
  }

  if (estado.estado === "cancelando") {
    return (
      <div className="mx-4 mt-1 rounded-md border border-alert-warning-border bg-alert-warning-bg px-4 py-3.5 text-alert-warning-text">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-[22px]">
            ⚠️
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-display-xs font-bold uppercase">
              Tu Premium termina el {FMT_DIA_MES.format(estado.proximoCobro)}
            </p>
            <p className="text-body-xs">
              Reactivá antes para no perder los picks 1:1.
            </p>
          </div>
          <Link
            href="/premium/mi-suscripcion"
            className="rounded-sm bg-alert-warning-text px-3 py-1.5 text-label-md font-bold text-white"
          >
            Reactivar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-1 rounded-md border border-premium-border bg-premium-card-gradient px-4 py-4 text-premium-text-on-dark shadow-premium-card">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-gold to-brand-gold-light text-[22px] text-brand-blue-dark"
        >
          💎
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-display-xs font-bold uppercase">
            Plan {labelPlan(estado.plan)} · Activo
          </p>
          <p className="text-body-xs text-premium-text-muted-on-dark">
            Próximo cobro: {FMT_DIA_MES.format(estado.proximoCobro)}
          </p>
        </div>
        <Link
          href="/premium/mi-suscripcion"
          className="rounded-sm bg-brand-gold px-3 py-1.5 text-label-md font-bold text-brand-blue-dark transition-transform hover:translate-x-0.5"
        >
          Gestionar →
        </Link>
      </div>
    </div>
  );
}

function labelPlan(plan: EstadoPremium["plan"]): string {
  if (plan === "mensual") return "Mensual";
  if (plan === "trimestral") return "Trimestral";
  return "Anual";
}
