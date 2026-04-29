// StatsGrid — pstat cards del mockup `.profile-stats-grid`.
//
// Lote 2 (Abr 2026): se demolió el sistema de Lukas. Pasa de 6 stats a 4
// (Torneos · Ganados · % Acierto · Mejor puesto). Sin balance ni "neto".

import type { PerfilCompleto } from "@/lib/services/usuarios.service";

interface StatsGridProps {
  perfil: PerfilCompleto;
}

export function StatsGrid({ perfil }: StatsGridProps) {
  const { stats, nivel } = perfil;

  const pills: Array<{
    icon: string;
    value: string;
    label: string;
    tone: "neutral" | "gold" | "green" | "purple";
  }> = [
    {
      icon: "⚽",
      value: nivel.torneosJugados.toString(),
      label: "Torneos jugados",
      tone: "neutral",
    },
    {
      icon: "🏆",
      value: stats.ganadas.toString(),
      label: "En top 10",
      tone: "gold",
    },
    {
      icon: "🎯",
      value: `${stats.aciertoPct}%`,
      label: "Tasa acierto",
      tone: "green",
    },
    {
      icon: "⭐",
      value: stats.mejorPuesto ? `${stats.mejorPuesto}°` : "—",
      label: "Mejor puesto",
      tone: "purple",
    },
  ];

  return (
    <section className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
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
  tone: "neutral" | "gold" | "green" | "purple";
}) {
  const valueCls =
    tone === "gold"
      ? "text-brand-gold-dark"
      : tone === "green"
        ? "text-alert-success-text"
        : tone === "purple"
          ? "text-accent-mundial-dark"
          : "text-dark";
  return (
    <div className="rounded-md border border-light bg-card px-2 py-3.5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div aria-hidden className="mb-1 text-xl leading-none">
        {icon}
      </div>
      <div
        className={`font-display text-[22px] font-black leading-none ${valueCls}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase leading-tight tracking-[0.05em] text-muted-d">
        {label}
      </div>
    </div>
  );
}
