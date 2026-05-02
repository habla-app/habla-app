// AlarmasHistoricoTabla — listing de alarmas pasadas. Lote G.

import type { AlarmaFila } from "@/lib/services/alarmas.service";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AdminTable } from "@/components/ui/admin/AdminTable";

interface Props {
  alarmas: AlarmaFila[];
}

export function AlarmasHistoricoTabla({ alarmas }: Props) {
  return (
    <AdminCard
      title="Histórico (últimas 50)"
      description="Alarmas desactivadas, recientes primero"
      bodyPadding="none"
    >
      <AdminTable
        data={alarmas}
        rowKey={(r) => r.id}
        empty="Sin alarmas en el histórico todavía."
        columns={[
          {
            key: "fecha",
            label: "Activa desde",
            render: (r) => (
              <span className="font-mono text-[11px] text-muted-d">
                {r.creadaEn.toLocaleString("es-PE", {
                  timeZone: "America/Lima",
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ),
          },
          {
            key: "tipo",
            label: "Tipo",
            render: (r) => (
              <span className="rounded-sm bg-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-muted-d">
                {r.tipo}
              </span>
            ),
          },
          {
            key: "severidad",
            label: "Severidad",
            render: (r) => (
              <span
                className={
                  r.severidad === "CRITICAL"
                    ? "text-status-red-text font-bold"
                    : r.severidad === "WARNING"
                      ? "text-status-amber-text font-bold"
                      : "text-muted-d"
                }
              >
                {r.severidad}
              </span>
            ),
          },
          {
            key: "titulo",
            label: "Título",
            render: (r) => <span className="text-dark">{r.titulo}</span>,
          },
          {
            key: "desactivadaEn",
            label: "Desactivada",
            render: (r) =>
              r.desactivadaEn ? (
                <span className="font-mono text-[11px] text-muted-d">
                  {r.desactivadaEn.toLocaleString("es-PE", {
                    timeZone: "America/Lima",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : (
                <span className="text-soft">—</span>
              ),
          },
          {
            key: "motivo",
            label: "Motivo",
            render: (r) => (
              <span className="text-admin-meta text-muted-d">
                {r.motivoDesactivacion ?? "—"}
              </span>
            ),
          },
        ]}
      />
    </AdminCard>
  );
}
