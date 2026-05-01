// CohorteSegmentos — sub-grid de segmentos por source. Lote G.

import type { SegmentoFila } from "@/lib/services/cohortes.service";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AdminTable } from "@/components/ui/admin/AdminTable";

interface Props {
  segmentos: SegmentoFila[];
}

export function CohorteSegmentos({ segmentos }: Props) {
  if (segmentos.length === 0) return null;
  return (
    <AdminCard
      title="Segmentos por source"
      description="Conversión Day 30 por origen de tráfico — últimos 6 meses"
      bodyPadding="none"
    >
      <AdminTable
        data={segmentos}
        rowKey={(r) => r.segmento}
        columns={[
          {
            key: "segmento",
            label: "Source",
            render: (r) => (
              <span className="font-mono text-dark">{r.segmento}</span>
            ),
          },
          {
            key: "totalUsuarios",
            label: "Usuarios",
            align: "right",
            render: (r) => (
              <span className="font-mono tabular-nums text-dark">
                {r.totalUsuarios.toLocaleString("es-PE")}
              </span>
            ),
          },
          {
            key: "conversionDay30",
            label: "Conv. Day 30",
            align: "right",
            render: (r) => (
              <span className="font-mono tabular-nums text-status-green-text">
                {r.conversionDay30.toFixed(1)}%
              </span>
            ),
          },
        ]}
      />
    </AdminCard>
  );
}
