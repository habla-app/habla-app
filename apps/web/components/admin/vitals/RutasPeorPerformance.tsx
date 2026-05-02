// RutasPeorPerformance — tabla de rutas ordenadas por peor LCP. Lote G.

import type { RutaPerformance } from "@/lib/services/vitals.service";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AdminTable } from "@/components/ui/admin/AdminTable";
import { cn } from "@/lib/utils/cn";

interface Props {
  rutas: RutaPerformance[];
}

function statusLcp(v: number | null) {
  if (v === null) return "neutral";
  if (v <= 2500) return "good";
  if (v <= 4000) return "amber";
  return "red";
}
function statusInp(v: number | null) {
  if (v === null) return "neutral";
  if (v <= 200) return "good";
  if (v <= 500) return "amber";
  return "red";
}
function statusCls(v: number | null) {
  if (v === null) return "neutral";
  if (v <= 0.1) return "good";
  if (v <= 0.25) return "amber";
  return "red";
}

const STATUS_COLOR: Record<string, string> = {
  good: "text-status-green-text",
  amber: "text-status-amber-text",
  red: "text-status-red-text",
  neutral: "text-soft",
};

export function RutasPeorPerformance({ rutas }: Props) {
  return (
    <AdminCard
      title="Rutas con peor performance"
      description="Top 20 rutas con LCP P75 más alto · Mínimo 5 visitas en el rango"
      bodyPadding="none"
    >
      <AdminTable
        data={rutas}
        rowKey={(r) => r.ruta}
        empty="Sin datos suficientes (necesario 5+ visitas por ruta)"
        columns={[
          {
            key: "ruta",
            label: "Ruta",
            render: (r) => (
              <span className="font-mono text-dark">{r.ruta}</span>
            ),
          },
          {
            key: "visitas",
            label: "Visitas",
            align: "right",
            render: (r) => (
              <span className="font-mono tabular-nums text-muted-d">
                {r.visitas.toLocaleString("es-PE")}
              </span>
            ),
          },
          {
            key: "lcpP75",
            label: "LCP P75",
            align: "right",
            render: (r) => {
              const s = statusLcp(r.lcpP75);
              return (
                <span className={cn("font-mono tabular-nums", STATUS_COLOR[s])}>
                  {r.lcpP75 === null
                    ? "—"
                    : `${(r.lcpP75 / 1000).toFixed(2)}s`}
                </span>
              );
            },
          },
          {
            key: "inpP75",
            label: "INP P75",
            align: "right",
            render: (r) => {
              const s = statusInp(r.inpP75);
              return (
                <span className={cn("font-mono tabular-nums", STATUS_COLOR[s])}>
                  {r.inpP75 === null ? "—" : `${Math.round(r.inpP75)}ms`}
                </span>
              );
            },
          },
          {
            key: "clsP75",
            label: "CLS P75",
            align: "right",
            render: (r) => {
              const s = statusCls(r.clsP75);
              return (
                <span className={cn("font-mono tabular-nums", STATUS_COLOR[s])}>
                  {r.clsP75 === null ? "—" : r.clsP75.toFixed(3)}
                </span>
              );
            },
          },
        ]}
      />
    </AdminCard>
  );
}
