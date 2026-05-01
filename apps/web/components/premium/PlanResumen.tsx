// PlanResumen — card con resumen del plan elegido en checkout (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/checkout.spec.md.
//
// Card con border dorado: nombre del plan + precio total + equivalencia
// mensual + garantía 7 días. Botón "Cambiar plan" linkea a /premium con
// el plan actual pre-seleccionado.

import Link from "next/link";
import type { PlanConfig } from "@/lib/premium-planes";

interface Props {
  plan: PlanConfig;
}

export function PlanResumen({ plan }: Props) {
  return (
    <div className="m-4 rounded-md border-2 border-brand-gold bg-card p-4 shadow-premium-cta">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-display-sm font-extrabold uppercase text-dark">
            Plan {plan.label}
            {plan.key === "anual" ? " · Más popular" : ""}
          </div>
          {plan.ahorroPct ? (
            <div className="mt-0.5 text-body-xs font-bold text-status-green">
              Ahorras {plan.ahorroPct}
            </div>
          ) : null}
        </div>
        <div className="text-right">
          <div className="font-display text-display-md font-extrabold leading-none text-dark">
            S/ {plan.precioSoles}
          </div>
          <div className="mt-0.5 text-body-xs text-muted-d">
            {plan.periodoCorto}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-body-xs text-muted-d">
        <span>{plan.equivalenciaMensual ?? "Sin compromiso"}</span>
        <span>✓ Garantía 7 días</span>
      </div>
      <div className="mt-3 border-t border-light pt-2 text-center">
        <Link
          href={`/premium?plan=${plan.key}`}
          className="text-body-xs font-bold text-brand-blue-main hover:underline"
        >
          Cambiar plan ›
        </Link>
      </div>
    </div>
  );
}
