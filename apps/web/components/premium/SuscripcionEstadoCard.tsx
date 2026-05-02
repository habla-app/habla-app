// SuscripcionEstadoCard — card oscura premium con estado actual (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/mi-suscripcion.spec.md.
//
// 3 estados visuales:
// - Activa: badge verde "Activa", próxima renovación, días restantes
// - Cancelando: badge amber, "Acceso hasta X", botón "Reactivar"
// - Vencida: badge gris, "Vencida hace X días"

import type { PlanConfig } from "@/lib/premium-planes";
import { formatearFechaLargaPe } from "@/lib/utils/datetime";

type Estado = "activa" | "cancelando" | "vencida";

interface Props {
  plan: PlanConfig;
  estado: Estado;
  proximoCobro: Date | null;
  vencimiento: Date | null;
}

interface BadgeCfg {
  label: string;
  className: string;
}

function badgeFor(estado: Estado): BadgeCfg {
  if (estado === "activa") {
    return {
      label: "✓ Activa",
      className: "bg-status-green-bg text-status-green-text",
    };
  }
  if (estado === "cancelando") {
    return {
      label: "⚠ Cancelando",
      className: "bg-status-amber-bg text-status-amber-text",
    };
  }
  return {
    label: "Vencida",
    className: "bg-status-neutral-bg text-status-neutral-text",
  };
}

function diasEntre(a: Date, b: Date): number {
  return Math.max(0, Math.floor((a.getTime() - b.getTime()) / 86_400_000));
}

export function SuscripcionEstadoCard({
  plan,
  estado,
  proximoCobro,
  vencimiento,
}: Props) {
  const badge = badgeFor(estado);
  const ahora = new Date();
  const fechaRef = vencimiento ?? proximoCobro;

  const subDescripcion = (() => {
    if (!fechaRef) return "Sin fecha definida";
    if (estado === "activa") {
      return `Próxima renovación: ${formatearFechaLargaPe(fechaRef)}`;
    }
    if (estado === "cancelando") {
      return `Acceso hasta: ${formatearFechaLargaPe(fechaRef)}`;
    }
    const dias = diasEntre(ahora, fechaRef);
    return dias > 0
      ? `Vencida hace ${dias} ${dias === 1 ? "día" : "días"}`
      : "Vencida";
  })();

  const diasRestantes =
    fechaRef && estado !== "vencida" ? diasEntre(fechaRef, ahora) : 0;

  return (
    <section
      aria-label="Estado de tu suscripción"
      className="relative mx-4 my-3 overflow-hidden rounded-md border border-premium-border bg-premium-card-gradient p-4 text-white shadow-premium-card"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold to-transparent"
      />
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-gold to-brand-gold-light text-2xl text-brand-blue-dark"
        >
          💎
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-display-sm font-extrabold uppercase">
              Plan {plan.label}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.05em] ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-body-xs text-premium-text-muted-on-dark">
            {subDescripcion}
          </p>
        </div>
      </div>

      {estado !== "vencida" ? (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
          <Stat
            label={estado === "activa" ? "Próximo cobro" : "Importe del plan"}
            valor={`S/ ${plan.precioSoles}`}
          />
          <Stat
            label="Días restantes"
            valor={diasRestantes.toString()}
          />
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.1em] text-white/60">
        {label}
      </div>
      <div className="mt-0.5 font-display text-num-md font-extrabold text-brand-gold">
        {valor}
      </div>
    </div>
  );
}
