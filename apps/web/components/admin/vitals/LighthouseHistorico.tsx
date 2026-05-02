// LighthouseHistorico — tabla de últimas N corridas Lighthouse. Lote G.

import type { LighthouseFila } from "@/lib/services/vitals.service";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AdminTable } from "@/components/ui/admin/AdminTable";
import { cn } from "@/lib/utils/cn";

interface Props {
  filas: LighthouseFila[];
}

function colorScore(score: number): string {
  if (score >= 90) return "text-status-green-text";
  if (score >= 75) return "text-status-amber-text";
  return "text-status-red-text";
}

export function LighthouseHistorico({ filas }: Props) {
  return (
    <AdminCard
      title="Histórico Lighthouse"
      description="Últimas 50 corridas · cron lunes 6 AM PET + manuales"
      bodyPadding="none"
    >
      <AdminTable
        data={filas}
        rowKey={(r) => r.id}
        empty="Sin corridas todavía. Configura PAGESPEED_API_KEY o corre manual desde el botón arriba."
        columns={[
          {
            key: "fecha",
            label: "Cuándo",
            render: (r) => (
              <span className="font-mono text-[11px] text-muted-d">
                {r.fecha.toLocaleString("es-PE", {
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
            key: "ruta",
            label: "Ruta",
            render: (r) => <span className="font-mono text-dark">{r.ruta}</span>,
          },
          {
            key: "device",
            label: "Device",
            render: (r) => (
              <span className="rounded-sm bg-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-muted-d">
                {r.device}
              </span>
            ),
          },
          {
            key: "performance",
            label: "Perf",
            align: "right",
            render: (r) => (
              <span
                className={cn(
                  "font-mono tabular-nums font-bold",
                  colorScore(r.performance),
                )}
              >
                {r.performance}
              </span>
            ),
          },
          {
            key: "accessibility",
            label: "A11y",
            align: "right",
            render: (r) => (
              <span className={cn("font-mono tabular-nums", colorScore(r.accessibility))}>
                {r.accessibility}
              </span>
            ),
          },
          {
            key: "bestPractices",
            label: "BP",
            align: "right",
            render: (r) => (
              <span className={cn("font-mono tabular-nums", colorScore(r.bestPractices))}>
                {r.bestPractices}
              </span>
            ),
          },
          {
            key: "seo",
            label: "SEO",
            align: "right",
            render: (r) => (
              <span className={cn("font-mono tabular-nums", colorScore(r.seo))}>
                {r.seo}
              </span>
            ),
          },
          {
            key: "origen",
            label: "Origen",
            render: (r) => (
              <span className="text-admin-meta text-muted-d">
                {r.origen === "manual" ? `Manual (${r.disparadoPor ?? "—"})` : "Cron"}
              </span>
            ),
          },
        ]}
      />
    </AdminCard>
  );
}
