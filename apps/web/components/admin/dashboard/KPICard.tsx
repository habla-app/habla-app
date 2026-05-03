// KPICard — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-kpi-card.
// Estructura HTML idéntica al mockup, clases del mockup
// (admin-kpi-card / admin-kpi-card-head / admin-kpi-card-label /
// admin-kpi-card-status admin-kpi-status-{good,amber,red} /
// admin-kpi-card-value / admin-kpi-card-trend {up,down,flat} /
// admin-kpi-card-target) que viven en `apps/web/app/mockup-styles.css`
// desde el Lote R.
//
// El componente acepta el tipo `KPI` del service `admin-kpis.service.ts`
// (Lote F). Los formatos de valor (number / percent / currency_pen /
// multiplier) se resuelven inline. Si `valor` es null muestra "—" y el
// status pasa a neutral.
import Link from "next/link";
import type { KPI } from "@/lib/services/admin-kpis.service";

interface KPICardProps {
  kpi: KPI;
  /** Link de drill-down opcional (ej. partidos del motor). */
  drillDownHref?: string;
}

const TREND_ARROW: Record<NonNullable<KPI["tendenciaDir"]>, string> = {
  up: "↗",
  down: "↘",
  flat: "→",
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
  const inner = (
    <>
      <div className="admin-kpi-card-head">
        <span className="admin-kpi-card-label">{kpi.label}</span>
        <span className={`admin-kpi-card-status admin-kpi-status-${kpi.status === "neutral" ? "amber" : kpi.status}`} />
      </div>
      <div className="admin-kpi-card-value">{formatearValor(kpi.valor, kpi.formato)}</div>
      {kpi.tendenciaDir && (
        <div className={`admin-kpi-card-trend ${kpi.tendenciaDir}`}>
          {TREND_ARROW[kpi.tendenciaDir]} {kpi.tendenciaPct ?? 0}% vs período anterior
        </div>
      )}
      {kpi.targetLabel && <div className="admin-kpi-card-target">Target: {kpi.targetLabel}</div>}
    </>
  );

  if (drillDownHref) {
    return (
      <Link href={drillDownHref} className="admin-kpi-card" style={{ cursor: "pointer", textDecoration: "none" }}>
        {inner}
      </Link>
    );
  }
  return <div className="admin-kpi-card">{inner}</div>;
}
