// CohorteHeatmap — heatmap CSS Grid (sin libs). Lote G.

import type { CohorteFila } from "@/lib/services/cohortes.service";
import { cn } from "@/lib/utils/cn";

const BUCKETS: ReadonlyArray<number> = [0, 1, 7, 14, 30, 60, 90];

interface Props {
  cohortes: CohorteFila[];
  /** Label de la métrica para tooltip. */
  metricLabel: string;
}

/**
 * Color del bucket basado en percentil relativo del set completo.
 * Verde fuerte = top 25%; rojo = bottom 25%. Neutral si null o cohorte
 * de 0 usuarios.
 */
function clasePorIntensidad(
  pct: number | null,
  percentilesGlobales: number[],
): string {
  if (pct === null) return "bg-soft/20 text-soft";
  if (percentilesGlobales.length === 0) return "bg-soft/30";

  const sorted = [...percentilesGlobales].sort((a, b) => a - b);
  const pos = sorted.findIndex((v) => v >= pct);
  const percentile = pos === -1 ? 100 : (pos / sorted.length) * 100;

  if (percentile >= 75) return "bg-status-green/30 text-dark";
  if (percentile >= 50) return "bg-status-green/20 text-dark";
  if (percentile >= 25) return "bg-status-amber/30 text-dark";
  if (percentile >= 10) return "bg-status-red/20 text-dark";
  return "bg-status-red/40 text-dark";
}

function pctEnBucket(c: CohorteFila, bucket: number): number | null {
  const v = c.conversiones.buckets[bucket as keyof typeof c.conversiones.buckets];
  if (v === null || c.totalUsuarios === 0) return null;
  return Math.round((v / c.totalUsuarios) * 1000) / 10;
}

export function CohorteHeatmap({ cohortes, metricLabel }: Props) {
  // Acumular todos los % no-null del heatmap para calcular percentiles
  const allPcts: number[] = [];
  for (const c of cohortes) {
    for (const b of BUCKETS) {
      const p = pctEnBucket(c, b);
      if (p !== null) allPcts.push(p);
    }
  }

  return (
    <div className="overflow-x-auto rounded-md border border-admin-table-border bg-admin-card-bg">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-admin-table-border bg-admin-table-row-stripe">
            <th
              scope="col"
              className="text-admin-table-header text-muted-d px-3 py-2.5 text-left"
            >
              Cohorte
            </th>
            <th
              scope="col"
              className="text-admin-table-header text-muted-d px-3 py-2.5 text-right"
            >
              Tamaño
            </th>
            {BUCKETS.map((b) => (
              <th
                key={b}
                scope="col"
                className="text-admin-table-header text-muted-d px-2 py-2.5 text-center"
              >
                D{b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohortes.map((c) => (
            <tr
              key={c.mes}
              className="border-b border-admin-table-border"
            >
              <td className="text-admin-table-cell text-dark px-3 py-2 font-medium">
                {c.mes}
                {c.enCurso && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-[0.06em] text-muted-d">
                    en curso
                  </span>
                )}
              </td>
              <td className="text-admin-table-cell text-muted-d px-3 py-2 text-right font-mono tabular-nums">
                {c.totalUsuarios.toLocaleString("es-PE")}
              </td>
              {BUCKETS.map((b) => {
                const pct = pctEnBucket(c, b);
                return (
                  <td
                    key={b}
                    title={`${metricLabel} · ${c.mes} · D${b}: ${pct === null ? "—" : `${pct.toFixed(1)}%`}`}
                    className={cn(
                      "px-2 py-2 text-center font-mono text-[12px] tabular-nums",
                      clasePorIntensidad(pct, allPcts),
                    )}
                  >
                    {pct === null ? "—" : `${pct.toFixed(0)}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
