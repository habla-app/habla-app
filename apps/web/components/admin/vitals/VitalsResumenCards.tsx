// VitalsResumenCards — 4 cards con percentil P75 + lighthouse promedio. Lote G.

import type { VitalsAgregadas } from "@/lib/services/vitals.service";
import { cn } from "@/lib/utils/cn";

interface Props {
  agregadas: VitalsAgregadas;
}

type Status = "good" | "amber" | "red" | "neutral";

function statusLcp(v: number | null): Status {
  if (v === null) return "neutral";
  if (v <= 2500) return "good";
  if (v <= 4000) return "amber";
  return "red";
}
function statusInp(v: number | null): Status {
  if (v === null) return "neutral";
  if (v <= 200) return "good";
  if (v <= 500) return "amber";
  return "red";
}
function statusCls(v: number | null): Status {
  if (v === null) return "neutral";
  if (v <= 0.1) return "good";
  if (v <= 0.25) return "amber";
  return "red";
}
function statusLh(v: number | null): Status {
  if (v === null) return "neutral";
  if (v >= 90) return "good";
  if (v >= 75) return "amber";
  return "red";
}

const STATUS_COLOR: Record<Status, string> = {
  good: "text-status-green-text",
  amber: "text-status-amber-text",
  red: "text-status-red-text",
  neutral: "text-muted-d",
};

const STATUS_BG: Record<Status, string> = {
  good: "bg-status-green-bg",
  amber: "bg-status-amber-bg",
  red: "bg-status-red-bg",
  neutral: "bg-admin-card-bg",
};

export function VitalsResumenCards({ agregadas }: Props) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
      <Card
        label="LCP P75"
        value={
          agregadas.lcpP75 === null
            ? "—"
            : `${(agregadas.lcpP75 / 1000).toFixed(2)}s`
        }
        target="<2.5s"
        status={statusLcp(agregadas.lcpP75)}
      />
      <Card
        label="INP P75"
        value={
          agregadas.inpP75 === null
            ? "—"
            : `${Math.round(agregadas.inpP75)}ms`
        }
        target="<200ms"
        status={statusInp(agregadas.inpP75)}
      />
      <Card
        label="CLS P75"
        value={
          agregadas.clsP75 === null
            ? "—"
            : agregadas.clsP75.toFixed(3)
        }
        target="<0.1"
        status={statusCls(agregadas.clsP75)}
      />
      <Card
        label="Lighthouse Mobile"
        value={
          agregadas.lighthousePerformance === null
            ? "—"
            : String(agregadas.lighthousePerformance)
        }
        target=">90"
        status={statusLh(agregadas.lighthousePerformance)}
      />
    </section>
  );
}

function Card({
  label,
  value,
  target,
  status,
}: {
  label: string;
  value: string;
  target: string;
  status: Status;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-admin-table-border p-4",
        STATUS_BG[status],
      )}
    >
      <div className="text-admin-label text-muted-d">{label}</div>
      <div className={cn("mt-2 text-kpi-value-md tabular-nums", STATUS_COLOR[status])}>
        {value}
      </div>
      <div className="mt-1 text-admin-meta text-muted-d">Target: {target}</div>
    </div>
  );
}
