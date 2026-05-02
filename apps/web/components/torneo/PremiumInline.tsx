// PremiumInline — banner promocional de Premium dentro del torneo
// (Lote C v3.1). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad-torneo-slug.spec.md.
//
// Aparece después del form de predicciones cuando el usuario NO es Premium.
// El copy default es "8 de los Top 10 usan Premium · Mira los picks que
// están sumando puntos". Variante FTD con copy más agresivo si hay datos
// de acierto del usuario (Lote E lo activa con `aciertoPropio`).
//
// Layout: card oscura premium-card-gradient + ícono dorado + CTA pill
// dorada "Probar →".

import Link from "next/link";

interface PremiumInlineProps {
  /** Si está, usa copy "Tu acierto X% → 65% con Premium" (FTD agresivo). */
  aciertoPropio?: number | null;
}

export function PremiumInline({ aciertoPropio }: PremiumInlineProps = {}) {
  const titulo =
    aciertoPropio !== null && aciertoPropio !== undefined
      ? `Tu acierto: ${aciertoPropio}% → 65% con Premium`
      : "8 de los Top 10 usan Premium";
  const sub =
    aciertoPropio !== null && aciertoPropio !== undefined
      ? "Picks con análisis estadístico, vía WhatsApp"
      : "Mira los picks que están sumando puntos";

  return (
    <Link
      href="/premium"
      aria-label="Probar Premium"
      className="group mx-4 flex items-center gap-3 rounded-md border border-premium-border bg-premium-card-gradient px-4 py-3.5 text-premium-text-on-dark shadow-premium-card transition-all hover:border-brand-gold/60 active:scale-[0.99]"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-brand-gold text-[20px] text-brand-blue-dark"
      >
        💎
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-display-xs font-bold uppercase leading-tight">
          {titulo}
        </p>
        <p className="text-body-xs text-premium-text-muted-on-dark">{sub}</p>
      </div>
      <span className="rounded-full bg-brand-gold px-3 py-1 text-label-md font-bold text-brand-blue-dark transition-transform group-hover:translate-x-0.5">
        Probar →
      </span>
    </Link>
  );
}
