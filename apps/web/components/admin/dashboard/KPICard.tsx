// KPICard — card individual de KPI con semáforo + tendencia. Lote F (May 2026).
// Spec: docs/ux-spec/05-pista-admin-operacion/dashboard.spec.md.
//
// Status indicator: dot circular en esquina superior derecha. Los tokens
// status-{green,amber,red} viven en tailwind.config.ts (Lote A §6).
//
// Si `valor` es null → muestra "—" + status neutral (no rompe la grid si
// la métrica no está disponible aún).
import Link from "next/link";
import type { KPI } from "@/lib/services/admin-kpis.service";
import { cn } from "@/lib/utils/cn";

interface KPICardProps {
  kpi: KPI;
  /** Link a vista de detalle del KPI (Lote G). */
  drillDownHref?: string;
}

const STATUS_DOT: Record<KPI["status"], string> = {
  good: "bg-status-green",
  amber: "bg-status-amber",
  red: "bg-status-red",
  neutral: "bg-soft",
};

const STATUS_LABEL: Record<KPI["status"], string> = {
  good: "OK",
  amber: "Atención",
  red: "Crítico",
  neutral: "Sin datos",
};

const TREND_ARROW: Record<NonNullable<KPI["tendenciaDir"]>, string> = {
  up: "↗",
  down: "↘",
  flat: "→",
};

const TREND_COLOR: Record<NonNullable<KPI["tendenciaDir"]>, string> = {
  up: "text-status-green-text",
  down: "text-status-red-text",
  flat: "text-muted-d",
};

function formatearValor(valor: number | null, formato: KPI["formato"]): string {
  if (valor === null) return "—";
  if (formato === "percent") return `${valor.toLocaleString("es-PE")}%`;
  if (formato === "currency_pen")
    return `S/ ${valor.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
  if (formato === "multiplier") return `${valor.toLocaleString("es-PE")}x`;
  return valor.toLocaleString("es-PE");
}

export function KPICard({ kpi, drillDownHref }: KPICardProps) {
  const cardClass = cn(
    "block rounded-md border border-admin-table-border bg-admin-card-bg p-4 transition-colors",
    drillDownHref && "hover:border-strong cursor-pointer",
  );

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-admin-label text-muted-d">{kpi.label}</div>
        <div className="flex items-center gap-1">
          {kpi.helpText && (
            <span
              aria-label={kpi.helpText}
              title={kpi.helpText}
              className="cursor-help text-soft"
            >
              ?
            </span>
          )}
          <span
            aria-label={STATUS_LABEL[kpi.status]}
            title={STATUS_LABEL[kpi.status]}
            className={cn("h-2 w-2 rounded-full", STATUS_DOT[kpi.status])}
          />
        </div>
      </div>
      <div className="mt-2 text-kpi-value-lg text-dark tabular-nums">
        {formatearValor(kpi.valor, kpi.formato)}
      </div>
      {kpi.tendenciaDir && (
        <div
          className={cn(
            "mt-1 text-kpi-trend tabular-nums",
            TREND_COLOR[kpi.tendenciaDir],
          )}
        >
          <span aria-hidden>{TREND_ARROW[kpi.tendenciaDir]}</span>{" "}
          {kpi.tendenciaPct ?? 0}% vs período anterior
        </div>
      )}
      {kpi.targetLabel && (
        <div className="mt-2 text-admin-meta text-muted-d">
          Target: {kpi.targetLabel}
        </div>
      )}
    </>
  );

  if (drillDownHref) {
    return (
      <Link href={drillDownHref} className={cardClass}>
        {inner}
      </Link>
    );
  }
  return <div className={cardClass}>{inner}</div>;
}
