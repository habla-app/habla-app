// PerfilPublicoStats — 6 stats canónicas del perfil público (Lote C v3.1,
// refactor mobile-first del Lote 11). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad-username.spec.md.

import type { TicketsStats } from "@/lib/services/tickets.service";
import type { MisStatsMensuales } from "@/lib/services/leaderboard.service";

interface PerfilPublicoStatsProps {
  stats: TicketsStats;
  mensual: MisStatsMensuales;
  nivelLabel: string;
}

export function PerfilPublicoStats({
  stats,
  mensual,
  nivelLabel,
}: PerfilPublicoStatsProps) {
  const items = [
    { value: stats.jugadas.toString(), label: "Predicciones" },
    { value: stats.ganadas.toString(), label: "Aciertos" },
    { value: `${stats.aciertoPct}%`, label: "Acierto" },
    {
      value: mensual.mejorMes ? `#${mensual.mejorMes.posicion}` : "—",
      label: "Mejor mes",
    },
    {
      value: stats.mejorPuesto ? `#${stats.mejorPuesto}` : "—",
      label: "Pos. histórica",
    },
    { value: nivelLabel, label: "Nivel" },
  ];

  return (
    <section className="grid grid-cols-3 gap-2 bg-card px-4 py-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-md bg-subtle px-2 py-3 text-center"
        >
          <div className="font-display text-[20px] font-black leading-none text-dark">
            {it.value}
          </div>
          <div className="mt-1 text-label-sm font-bold uppercase tracking-[0.04em] text-muted-d">
            {it.label}
          </div>
        </div>
      ))}
    </section>
  );
}
