// VitalsCharts — 3 line charts compactos (LCP/INP/CLS). Lote G.

import type { VitalsChartPunto } from "@/lib/services/vitals.service";
import { AdminCard } from "@/components/ui/admin/AdminCard";

interface Props {
  charts: VitalsChartPunto[];
}

interface MiniChartProps {
  serie: Array<{ dia: string; valor: number | null }>;
  target: number;
  formato: "ms" | "score";
  label: string;
}

function MiniChart({ serie, target, formato, label }: MiniChartProps) {
  const valores = serie.map((p) => p.valor).filter((v): v is number => v !== null);
  if (valores.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-sm border border-dashed border-admin-table-border bg-admin-card-bg text-admin-meta text-muted-d">
        Sin datos suficientes
      </div>
    );
  }
  const w = 320;
  const h = 100;
  const padX = 8;
  const padY = 8;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;
  const allValues = [...valores, target];
  const minY = Math.min(...allValues, 0);
  const maxY = Math.max(...allValues);
  const range = Math.max(1, maxY - minY);

  function xs(i: number, n: number) {
    return n <= 1 ? padX + chartW / 2 : padX + (i / (n - 1)) * chartW;
  }
  function ys(v: number) {
    return padY + chartH - ((v - minY) / range) * chartH;
  }

  const points = serie
    .map((p, i) => (p.valor === null ? null : `${xs(i, serie.length)},${ys(p.valor)}`))
    .filter((s): s is string => s !== null)
    .join(" ");

  const ultimo = valores[valores.length - 1] ?? 0;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-admin-label text-muted-d">{label}</span>
        <span className="font-mono text-[12px] text-dark tabular-nums">
          {formato === "ms"
            ? `${Math.round(ultimo)}ms`
            : ultimo.toFixed(3)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Histórico de ${label}`}
      >
        {/* Target line */}
        <line
          x1={padX}
          x2={padX + chartW}
          y1={ys(target)}
          y2={ys(target)}
          className="stroke-status-green-text"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <polyline
          fill="none"
          className="stroke-brand-blue-main"
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    </div>
  );
}

export function VitalsCharts({ charts }: Props) {
  const lcpSerie = charts.map((p) => ({ dia: p.dia, valor: p.lcpP75 }));
  const inpSerie = charts.map((p) => ({ dia: p.dia, valor: p.inpP75 }));
  const clsSerie = charts.map((p) => ({ dia: p.dia, valor: p.clsP75 }));

  return (
    <AdminCard
      title="Tendencia P75 últimos 30 días"
      bodyPadding="md"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MiniChart serie={lcpSerie} target={2500} formato="ms" label="LCP P75" />
        <MiniChart serie={inpSerie} target={200} formato="ms" label="INP P75" />
        <MiniChart serie={clsSerie} target={0.1} formato="score" label="CLS P75" />
      </div>
    </AdminCard>
  );
}
