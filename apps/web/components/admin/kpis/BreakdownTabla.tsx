// BreakdownTabla — tabla de breakdown por dimensión. Lote G.

import type { FilaBreakdown } from "@/lib/services/kpi-detalle.service";
import type { KPIMeta } from "@/lib/services/kpis-metadata";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AdminTable } from "@/components/ui/admin/AdminTable";
import { cn } from "@/lib/utils/cn";

interface Props {
  meta: KPIMeta;
  filas: FilaBreakdown[];
}

const DIMENSION_LABEL: Record<string, string> = {
  liga: "Liga",
  casa: "Casa",
  plan: "Plan",
  origen: "Origen",
  source: "Source",
  device: "Device",
  ruta: "Ruta",
};

function formatearValor(valor: number, meta: KPIMeta): string {
  if (meta.formato === "percent") return `${valor.toLocaleString("es-PE")}%`;
  if (meta.formato === "currency_pen") return `S/ ${valor.toLocaleString("es-PE")}`;
  return valor.toLocaleString("es-PE");
}

export function BreakdownTabla({ meta, filas }: Props) {
  if (!meta.dimensionPrincipal || filas.length === 0) {
    return null;
  }
  const dimensionLabel =
    DIMENSION_LABEL[meta.dimensionPrincipal] ?? "Dimensión";

  return (
    <AdminCard
      title={`Breakdown por ${dimensionLabel.toLowerCase()}`}
      description="Top 15 — desglose del KPI según la dimensión principal."
      bodyPadding="none"
    >
      <AdminTable
        data={filas}
        rowKey={(r) => r.dimension}
        columns={[
          {
            key: "dimension",
            label: dimensionLabel,
            render: (r) => <span className="font-medium text-dark">{r.dimension}</span>,
          },
          {
            key: "valor",
            label: "Valor",
            align: "right",
            render: (r) => (
              <span className="font-mono tabular-nums text-dark">
                {formatearValor(r.valor, meta)}
              </span>
            ),
          },
          {
            key: "contribucionPct",
            label: "% del total",
            align: "right",
            render: (r) => (
              <span className="font-mono tabular-nums text-muted-d">
                {r.contribucionPct.toFixed(1)}%
              </span>
            ),
          },
          {
            key: "cambioPct",
            label: "vs periodo ant.",
            align: "right",
            render: (r) => {
              if (r.cambioPct === null) return <span className="text-soft">—</span>;
              return (
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    r.cambioPct > 1
                      ? "text-status-green-text"
                      : r.cambioPct < -1
                        ? "text-status-red-text"
                        : "text-muted-d",
                  )}
                >
                  {r.cambioPct > 0 ? "+" : ""}
                  {r.cambioPct.toFixed(1)}%
                </span>
              );
            },
          },
        ]}
      />
    </AdminCard>
  );
}
