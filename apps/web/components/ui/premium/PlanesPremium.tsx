"use client";

// PlanesPremium — selector de planes (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/premium-landing.spec.md.
//
// 3 cards con planes Mensual/Trimestral/Anual. Anual destacado con badge
// "Más popular" + border dorado + shadow gold. Click en un plan dispara
// `onSelect(planKey)` para que la landing actualice su sticky CTA.

import { useState } from "react";
import { track } from "@/lib/analytics";
import type { PlanKey } from "@/lib/premium-planes";
import { PLANES } from "@/lib/premium-planes";

interface Props {
  /** Plan inicialmente seleccionado. Default: 'anual'. */
  initialPlan?: PlanKey;
  /** Callback cuando user selecciona un plan distinto al actual. */
  onSelect?: (plan: PlanKey) => void;
}

export function PlanesPremium({ initialPlan = "anual", onSelect }: Props) {
  const [seleccionado, setSeleccionado] = useState<PlanKey>(initialPlan);

  const handleSelect = (plan: PlanKey) => {
    setSeleccionado(plan);
    onSelect?.(plan);
    track("premium_plan_seleccionado", { plan });
  };

  const ordenado: Array<PlanKey> = ["mensual", "anual", "trimestral"];

  return (
    <section
      aria-label="Planes Premium"
      className="bg-subtle px-4 pb-2 pt-4"
    >
      <ul className="space-y-3">
        {ordenado.map((key) => {
          const plan = PLANES[key];
          const popular = key === "anual";
          const activo = seleccionado === key;
          return (
            <li key={key} className="relative">
              {popular ? (
                <span
                  aria-hidden
                  className="absolute -top-2.5 left-1/2 z-base -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-gold px-3 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-brand-blue-dark"
                >
                  Más popular
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => handleSelect(key)}
                aria-pressed={activo}
                className={`touch-target relative flex w-full items-center justify-between rounded-md border-2 bg-card p-4 text-left transition-all ${
                  popular
                    ? "border-brand-gold shadow-premium-cta"
                    : "border-light"
                } ${activo ? "ring-2 ring-brand-gold/30" : ""}`}
              >
                <div className="min-w-0">
                  <div className="font-display text-display-sm font-extrabold uppercase text-dark">
                    {plan.label}
                  </div>
                  <div className="mt-0.5 text-body-xs leading-snug text-muted-d">
                    {plan.subtitulo}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-display-md font-extrabold text-dark">
                    S/ {plan.precioSoles}
                  </div>
                  <div className="text-body-xs text-muted-d">
                    {plan.periodoCorto}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
