// KPIChart — line chart histórico SVG nativo (zero deps). Lote G.
//
// Renderea actual + periodo anterior superpuesto. Target line opcional.

import type { PuntoTemporal } from "@/lib/services/kpi-detalle.service";
import { cn } from "@/lib/utils/cn";

interface KPIChartProps {
  serie: PuntoTemporal[];
  serieAnterior?: PuntoTemporal[];
  target?: number | null;
  formato: "number" | "percent" | "currency_pen" | "multiplier" | "duration_ms";
  /** Color del estado para la línea principal. */
  status: "good" | "amber" | "red" | "neutral";
  height?: number;
}

const STATUS_STROKE: Record<KPIChartProps["status"], string> = {
  good: "stroke-status-green",
  amber: "stroke-status-amber",
  red: "stroke-status-red",
  neutral: "stroke-soft",
};

function formatearTick(valor: number, formato: KPIChartProps["formato"]): string {
  if (formato === "percent") return `${valor.toFixed(0)}%`;
  if (formato === "currency_pen") return `S/${valor.toLocaleString("es-PE")}`;
  if (formato === "multiplier") return `${valor.toFixed(1)}x`;
  if (formato === "duration_ms") return `${valor.toFixed(0)}ms`;
  return valor.toLocaleString("es-PE");
}

export function KPIChart({
  serie,
  serieAnterior,
  target,
  formato,
  status,
  height = 240,
}: KPIChartProps) {
  if (serie.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-md border border-dashed border-admin-table-border bg-admin-card-bg text-admin-body text-muted-d">
        Sin datos en el rango seleccionado.
      </div>
    );
  }

  const width = 800;
  const padX = 56;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const valoresActual = serie.map((p) => p.valor);
  const valoresAnt = serieAnterior?.map((p) => p.valor) ?? [];
  const allValues = [...valoresActual, ...valoresAnt];
  if (target !== null && target !== undefined) allValues.push(target);
  const minY = Math.min(...allValues, 0);
  const maxY = Math.max(...allValues, 1);
  const rangeY = Math.max(1, maxY - minY);

  function xScale(i: number, total: number): number {
    if (total <= 1) return padX + chartW / 2;
    return padX + (i / (total - 1)) * chartW;
  }
  function yScale(v: number): number {
    return padY + chartH - ((v - minY) / rangeY) * chartH;
  }

  const pathActual = serie
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i, serie.length)} ${yScale(p.valor)}`)
    .join(" ");

  const pathAnt =
    serieAnterior && serieAnterior.length > 0
      ? serieAnterior
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"} ${xScale(i, serieAnterior.length)} ${yScale(p.valor)}`,
          )
          .join(" ")
      : null;

  // Ticks Y: 4 niveles
  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => minY + rangeY * f);

  return (
    <div className="overflow-x-auto rounded-md border border-admin-table-border bg-admin-card-bg p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Gráfica histórica del KPI"
      >
        {/* Grid Y */}
        {ticksY.map((tick, i) => (
          <g key={i}>
            <line
              x1={padX}
              x2={padX + chartW}
              y1={yScale(tick)}
              y2={yScale(tick)}
              className="stroke-admin-table-border"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <text
              x={padX - 8}
              y={yScale(tick) + 4}
              className="fill-muted-d font-mono"
              fontSize="11"
              textAnchor="end"
            >
              {formatearTick(tick, formato)}
            </text>
          </g>
        ))}

        {/* Target line */}
        {target !== null && target !== undefined && (
          <g>
            <line
              x1={padX}
              x2={padX + chartW}
              y1={yScale(target)}
              y2={yScale(target)}
              className="stroke-status-green-text"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text
              x={padX + chartW - 4}
              y={yScale(target) - 4}
              className="fill-status-green-text font-mono"
              fontSize="11"
              textAnchor="end"
            >
              Target {formatearTick(target, formato)}
            </text>
          </g>
        )}

        {/* Periodo anterior */}
        {pathAnt && (
          <path
            d={pathAnt}
            fill="none"
            className="stroke-soft"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}

        {/* Periodo actual */}
        <path
          d={pathActual}
          fill="none"
          className={cn(STATUS_STROKE[status])}
          strokeWidth="2.25"
        />

        {/* Puntos del periodo actual */}
        {serie.map((p, i) => (
          <circle
            key={i}
            cx={xScale(i, serie.length)}
            cy={yScale(p.valor)}
            r="3"
            className={cn("fill-admin-card-bg", STATUS_STROKE[status])}
            strokeWidth="2"
          >
            <title>
              {p.fecha} · {formatearTick(p.valor, formato)}
            </title>
          </circle>
        ))}

        {/* Eje X — primero/medio/último */}
        {[0, Math.floor(serie.length / 2), serie.length - 1].map((i) => {
          const p = serie[i];
          if (!p) return null;
          return (
            <text
              key={i}
              x={xScale(i, serie.length)}
              y={padY + chartH + 16}
              className="fill-muted-d font-mono"
              fontSize="11"
              textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"}
            >
              {p.fecha.slice(5)}
            </text>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center gap-4 text-admin-meta text-muted-d">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "inline-block h-2.5 w-5 rounded-sm",
              status === "good"
                ? "bg-status-green"
                : status === "amber"
                  ? "bg-status-amber"
                  : status === "red"
                    ? "bg-status-red"
                    : "bg-soft",
            )}
          />
          Periodo actual
        </span>
        {pathAnt && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-5 rounded-sm bg-soft opacity-60"
            />
            Periodo anterior
          </span>
        )}
      </div>
    </div>
  );
}
