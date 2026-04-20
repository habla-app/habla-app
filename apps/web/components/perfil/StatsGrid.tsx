// StatsGrid — 6 pills del perfil. Sub-Sprint 7.
import type { PerfilCompleto } from "@/lib/services/usuarios.service";

interface StatsGridProps {
  perfil: PerfilCompleto;
}

export function StatsGrid({ perfil }: StatsGridProps) {
  const { stats, nivel, balanceLukas } = perfil;
  const pills = [
    { label: "Torneos", value: nivel.torneosJugados.toString(), tone: "blue" as const },
    { label: "Ganados", value: stats.ganadas.toString(), tone: "gold" as const },
    { label: "Acierto", value: `${stats.aciertoPct}%`, tone: "green" as const },
    { label: "Balance", value: `${balanceLukas}`, tone: "gold" as const },
    { label: "Neto", value: `${stats.neto >= 0 ? "+" : ""}${stats.neto}`, tone: stats.neto >= 0 ? ("green" as const) : ("red" as const) },
    {
      label: "Mejor puesto",
      value: stats.mejorPuesto ? `#${stats.mejorPuesto}` : "—",
      tone: "blue" as const,
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
      {pills.map((p) => (
        <div key={p.label} className="rounded-md border border-light bg-card p-3 text-center">
          <div className="text-[11px] uppercase tracking-wide text-muted-d">
            {p.label}
          </div>
          <div
            className={`mt-1 font-display text-[18px] font-extrabold ${
              p.tone === "gold"
                ? "text-brand-gold-dark"
                : p.tone === "green"
                  ? "text-brand-green"
                  : p.tone === "red"
                    ? "text-urgent-critical"
                    : "text-brand-blue-main"
            }`}
          >
            {p.value}
          </div>
        </div>
      ))}
    </div>
  );
}
