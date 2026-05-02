// CambiarPlanSection — selector de plan en mi-suscripcion (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/mi-suscripcion.spec.md.
//
// Muestra los 3 planes con el actual destacado. El cambio efectivo se
// difiere a Lote F (operación admin → propaga al user) por la complejidad
// con OpenPay (re-cobro proporcional). Aquí mostramos el copy "Para cambiar
// de plan, contacta soporte" como fallback temporal.

import Link from "next/link";
import type { PlanKey } from "@/lib/premium-planes";
import { PLANES } from "@/lib/premium-planes";

interface Props {
  planActual: PlanKey;
}

const ORDEN: Array<PlanKey> = ["mensual", "trimestral", "anual"];

export function CambiarPlanSection({ planActual }: Props) {
  return (
    <section
      aria-label="Cambiar plan"
      className="border-b border-light bg-card px-4 py-5"
    >
      <h3 className="mb-3 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
        🔄 Cambiar plan
      </h3>
      <ul className="grid grid-cols-3 gap-1.5">
        {ORDEN.map((key) => {
          const plan = PLANES[key];
          const actual = key === planActual;
          return (
            <li
              key={key}
              className={`relative rounded-sm border-[1.5px] p-2 text-center ${
                actual
                  ? "border-brand-gold bg-brand-gold-dim"
                  : "border-light bg-subtle"
              }`}
            >
              {actual ? (
                <span
                  aria-hidden
                  className="mb-1 inline-block rounded-sm bg-brand-gold px-1 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.05em] text-brand-blue-dark"
                >
                  Actual
                </span>
              ) : null}
              <div className="font-display text-[11px] font-bold uppercase text-dark">
                {plan.label}
              </div>
              <div className="font-display text-display-xs font-extrabold text-dark">
                S/ {plan.precioSoles}
              </div>
              <div className="text-[9px] text-muted-d">
                {plan.equivalenciaMensual ?? "/ mes"}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-center text-body-xs text-muted-d">
        Para cambiar de plan,{" "}
        <Link
          href="/ayuda/faq"
          className="font-bold text-brand-blue-main hover:underline"
        >
          contacta soporte
        </Link>
        . Aplicamos prorrateo desde la siguiente renovación.
      </p>
    </section>
  );
}
