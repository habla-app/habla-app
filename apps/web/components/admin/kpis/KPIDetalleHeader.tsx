// KPIDetalleHeader — bloque superior con valor actual + status + tendencia. Lote G.

import type {
  KPIDetalleHeader as HeaderData,
  StatusKPI,
} from "@/lib/services/kpi-detalle.service";
import type { FormatoKPI } from "@/lib/services/kpis-metadata";
import { cn } from "@/lib/utils/cn";

interface Props {
  header: HeaderData;
}

const STATUS_DOT: Record<StatusKPI, string> = {
  good: "bg-status-green",
  amber: "bg-status-amber",
  red: "bg-status-red",
  neutral: "bg-soft",
};

const STATUS_LABEL: Record<StatusKPI, string> = {
  good: "OK",
  amber: "Atención",
  red: "Crítico",
  neutral: "Sin datos",
};

const STATUS_BG: Record<StatusKPI, string> = {
  good: "bg-status-green-bg border-status-green",
  amber: "bg-status-amber-bg border-status-amber",
  red: "bg-status-red-bg border-status-red",
  neutral: "bg-admin-card-bg border-admin-table-border",
};

function formatear(valor: number | null, formato: FormatoKPI): string {
  if (valor === null) return "—";
  if (formato === "percent") return `${valor.toLocaleString("es-PE")}%`;
  if (formato === "currency_pen") return `S/ ${valor.toLocaleString("es-PE")}`;
  if (formato === "multiplier") return `${valor.toLocaleString("es-PE")}x`;
  if (formato === "duration_ms") return `${valor.toLocaleString("es-PE")}ms`;
  return valor.toLocaleString("es-PE");
}

export function KPIDetalleHeader({ header }: Props) {
  return (
    <section
      className={cn(
        "rounded-md border p-5 mb-6",
        STATUS_BG[header.status],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              aria-label={STATUS_LABEL[header.status]}
              title={STATUS_LABEL[header.status]}
              className={cn("h-3 w-3 rounded-full", STATUS_DOT[header.status])}
            />
            <h2 className="text-admin-page-title text-dark">{header.label}</h2>
            {header.pendienteCableado && (
              <span className="rounded-sm bg-status-amber-bg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-status-amber-text">
                Pendiente cableado
              </span>
            )}
          </div>
          <p className="mt-1 text-admin-body text-muted-d">
            {header.descripcion}
          </p>
        </div>
        <div className="text-right">
          <div className="text-kpi-value-lg text-dark tabular-nums">
            {formatear(header.valorActual, header.formato)}
          </div>
          {header.targetLabel && (
            <div className="mt-1 text-admin-meta text-muted-d">
              Target: {header.targetLabel}
            </div>
          )}
          {header.cambioPct !== null && (
            <div
              className={cn(
                "mt-1 text-admin-meta tabular-nums",
                header.cambioPct > 0
                  ? "text-status-green-text"
                  : header.cambioPct < 0
                    ? "text-status-red-text"
                    : "text-muted-d",
              )}
            >
              {header.cambioPct > 0 ? "↗ +" : header.cambioPct < 0 ? "↘ " : "→ "}
              {Math.abs(header.cambioPct)}% vs periodo anterior
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
