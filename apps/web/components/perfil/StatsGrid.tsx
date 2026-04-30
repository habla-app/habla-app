// StatsGrid — pstat cards del mockup `.profile-stats-grid`.
//
// Lote 11 (May 2026): 6 stats (Predicciones · Aciertos · % Acierto ·
// Mejor mes · Posición histórica · Nivel). Combina datos de
// `PerfilCompleto` (ya cubre torneos jugados / mejor puesto / nivel) y
// `MisStatsMensuales` del Lote 5 (mejor mes histórico). Si el usuario
// nunca ganó un mes, el campo cae a "—".

import type { PerfilCompleto } from "@/lib/services/usuarios.service";
import type { MisStatsMensuales } from "@/lib/services/leaderboard.service";

interface StatsGridProps {
  perfil: PerfilCompleto;
  /** Stats mensuales (Lote 5). Si el usuario nunca ganó un mes,
   *  `mejorMes` es null. */
  mensual?: MisStatsMensuales | null;
}

export function StatsGrid({ perfil, mensual }: StatsGridProps) {
  const { stats, nivel } = perfil;

  const pills: Array<{
    icon: string;
    value: string;
    label: string;
    tone: "neutral" | "gold" | "green" | "purple" | "blue";
  }> = [
    {
      icon: "🎯",
      value: stats.jugadas.toString(),
      label: "Predicciones",
      tone: "neutral",
    },
    {
      icon: "🏆",
      value: stats.ganadas.toString(),
      label: "Aciertos (Top 10)",
      tone: "gold",
    },
    {
      icon: "📈",
      value: `${stats.aciertoPct}%`,
      label: "% Acierto",
      tone: "green",
    },
    {
      icon: "🥇",
      value: mensual?.mejorMes ? `#${mensual.mejorMes.posicion}` : "—",
      label: "Mejor mes",
      tone: "blue",
    },
    {
      icon: "⭐",
      value: stats.mejorPuesto ? `${stats.mejorPuesto}°` : "—",
      label: "Pos. histórica",
      tone: "purple",
    },
    {
      icon: nivel.actual.emoji,
      value: nivel.actual.label,
      label: "Nivel",
      tone: "gold",
    },
  ];

  return (
    <section className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
      {pills.map((p) => (
        <PStat key={p.label} {...p} />
      ))}
    </section>
  );
}

function PStat({
  icon,
  value,
  label,
  tone,
}: {
  icon: string;
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
    <div className="rounded-md border border-light bg-card px-2 py-3.5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div aria-hidden className="mb-1 text-xl leading-none">
        {icon}
      </div>
      <div
        className={`font-display text-[18px] font-black leading-tight md:text-[20px] ${valueCls}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase leading-tight tracking-[0.05em] text-muted-d">
        {label}
      </div>
    </div>
  );
}
