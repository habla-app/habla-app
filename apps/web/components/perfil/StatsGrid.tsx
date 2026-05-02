// StatsGrid — 6 stats del perfil (Lote C v3.1, refactor del Lote 11).
// Spec: docs/ux-spec/03-pista-usuario-autenticada/perfil.spec.md.
//
// Cambios vs Lote 11:
//   - Grid mobile 3-columnas (era 2-columnas), aprovecha la tipografía
//     `text-num-*` para que los números más largos no rompan el layout.
//   - Cada card tiene padding más compacto pensado para 375px.
//   - Stats: Predicciones · Aciertos · % Acierto · Mejor mes · Pos.
//     histórica · Nivel.
//   - Cero hex hardcodeados.

import type { PerfilCompleto } from "@/lib/services/usuarios.service";
import type { MisStatsMensuales } from "@/lib/services/leaderboard.service";

interface StatsGridProps {
  perfil: PerfilCompleto;
  mensual?: MisStatsMensuales | null;
}

export function StatsGrid({ perfil, mensual }: StatsGridProps) {
  const { stats, nivel } = perfil;

  const items: Array<{
    value: string;
    label: string;
    tone: "neutral" | "gold" | "green" | "purple" | "blue";
  }> = [
    {
      value: stats.jugadas.toString(),
      label: "Predicciones",
      tone: "neutral",
    },
    {
      value: stats.ganadas.toString(),
      label: "Aciertos",
      tone: "gold",
    },
    {
      value: `${stats.aciertoPct}%`,
      label: "Acierto",
      tone: "green",
    },
    {
      value: mensual?.mejorMes ? `#${mensual.mejorMes.posicion}` : "—",
      label: "Mejor mes",
      tone: "blue",
    },
    {
      value: stats.mejorPuesto ? `#${stats.mejorPuesto}` : "—",
      label: "Pos. histórica",
      tone: "purple",
    },
    {
      value: nivel.actual.label,
      label: "Nivel",
      tone: "gold",
    },
  ];

  return (
    <section className="grid grid-cols-3 gap-2 bg-card px-4 py-4">
      {items.map((it) => (
        <StatCard key={it.label} {...it} />
      ))}
    </section>
  );
}

function StatCard({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "neutral" | "gold" | "green" | "purple" | "blue";
}) {
  const valueCls =
    tone === "gold"
      ? "text-brand-gold-dark"
      : tone === "green"
        ? "text-alert-success-text"
        : tone === "purple"
          ? "text-accent-mundial-dark"
          : tone === "blue"
            ? "text-brand-blue-main"
            : "text-dark";
  return (
    <div className="rounded-md bg-subtle px-2 py-3 text-center">
      <div
        className={`font-display text-[22px] font-black leading-none ${valueCls}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-label-sm font-bold uppercase tracking-[0.04em] text-muted-d">
        {label}
      </div>
    </div>
  );
}
