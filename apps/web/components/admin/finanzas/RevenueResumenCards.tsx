// RevenueResumenCards — 4 cards principales finanzas. Lote G.

import { cn } from "@/lib/utils/cn";

interface Props {
  revenueMes: number;
  mrr: number;
  margenPct: number | null;
  ltvCacRatio: number | null;
}

export function RevenueResumenCards({
  revenueMes,
  mrr,
  margenPct,
  ltvCacRatio,
}: Props) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
      <Card label="Revenue mes en curso" value={`S/ ${revenueMes.toLocaleString("es-PE")}`} />
      <Card label="MRR Premium" value={`S/ ${mrr.toLocaleString("es-PE")}`} />
      <Card
        label="Margen operativo"
        value={margenPct === null ? "—" : `${margenPct.toFixed(1)}%`}
        tone={
          margenPct === null
            ? "neutral"
            : margenPct >= 60
              ? "good"
              : margenPct >= 40
                ? "amber"
                : "red"
        }
      />
      <Card
        label="LTV / CAC"
        value={ltvCacRatio === null ? "—" : `${ltvCacRatio.toFixed(1)}x`}
        tone={
          ltvCacRatio === null
            ? "neutral"
            : ltvCacRatio >= 3
              ? "good"
              : ltvCacRatio >= 2
                ? "amber"
                : "red"
        }
      />
    </section>
  );
}

const TONE_BG: Record<string, string> = {
  good: "bg-status-green-bg",
  amber: "bg-status-amber-bg",
  red: "bg-status-red-bg",
  neutral: "bg-admin-card-bg",
};

const TONE_VALUE: Record<string, string> = {
  good: "text-status-green-text",
  amber: "text-status-amber-text",
  red: "text-status-red-text",
  neutral: "text-dark",
};

function Card({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "amber" | "red" | "neutral";
}) {
  return (
    <div
      className={cn("rounded-md border border-admin-table-border p-4", TONE_BG[tone])}
    >
      <div className="text-admin-label text-muted-d">{label}</div>
      <div className={cn("mt-2 text-kpi-value-md tabular-nums", TONE_VALUE[tone])}>
        {value}
      </div>
    </div>
  );
}
