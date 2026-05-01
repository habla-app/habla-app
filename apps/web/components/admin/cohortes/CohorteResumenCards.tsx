// CohorteResumenCards — 3 cards con conclusiones del análisis. Lote G.

import type { CohortesData } from "@/lib/services/cohortes.service";
import { cn } from "@/lib/utils/cn";

interface Props {
  resumen: CohortesData["resumen"];
}

export function CohorteResumenCards({ resumen }: Props) {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3 mb-6">
      <Card title="Mejor cohorte (Day 30)">
        {resumen.mejorMes ? (
          <>
            <div className="text-kpi-value-md text-status-green-text tabular-nums">
              {resumen.mejorMes.pct.toFixed(1)}%
            </div>
            <div className="mt-1 text-admin-meta text-muted-d">
              {resumen.mejorMes.mes}
            </div>
          </>
        ) : (
          <div className="text-admin-body text-muted-d">—</div>
        )}
      </Card>
      <Card title="Peor cohorte (Day 30)">
        {resumen.peorMes ? (
          <>
            <div className="text-kpi-value-md text-status-red-text tabular-nums">
              {resumen.peorMes.pct.toFixed(1)}%
            </div>
            <div className="mt-1 text-admin-meta text-muted-d">
              {resumen.peorMes.mes}
            </div>
          </>
        ) : (
          <div className="text-admin-body text-muted-d">—</div>
        )}
      </Card>
      <Card title="Tendencia últimos 3 meses">
        {resumen.tendencia3m ? (
          <>
            <div
              className={cn(
                "text-kpi-value-md tabular-nums",
                resumen.tendencia3m.dir === "up"
                  ? "text-status-green-text"
                  : resumen.tendencia3m.dir === "down"
                    ? "text-status-red-text"
                    : "text-muted-d",
              )}
            >
              {resumen.tendencia3m.dir === "up"
                ? "↗ "
                : resumen.tendencia3m.dir === "down"
                  ? "↘ "
                  : "→ "}
              {resumen.tendencia3m.pct.toFixed(1)} pts
            </div>
            <div className="mt-1 text-admin-meta text-muted-d">
              vs 3 meses anteriores
            </div>
          </>
        ) : (
          <div className="text-admin-body text-muted-d">Datos insuficientes</div>
        )}
      </Card>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-admin-table-border bg-admin-card-bg p-4">
      <div className="text-admin-label text-muted-d mb-1.5">{title}</div>
      {children}
    </div>
  );
}
