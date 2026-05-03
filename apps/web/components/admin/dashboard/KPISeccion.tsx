// KPISeccion — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-kpi-section.
// HTML idéntico al mockup, clases del mockup (admin-kpi-section /
// admin-kpi-section-header / admin-kpi-section-title /
// admin-kpi-section-meta / admin-kpi-grid).
import type { KpisGrupo } from "@/lib/services/admin-kpis.service";
import { KPICard } from "./KPICard";

interface KPISeccionProps {
  grupo: KpisGrupo;
  /** Subtítulo opcional de la sección (mockup: admin-kpi-section-meta). */
  meta?: string;
  /** Drill-down opcional para algunos KPIs (ej. motor → /admin/motor). */
  drillDownHref?: string;
}

export function KPISeccion({ grupo, meta, drillDownHref }: KPISeccionProps) {
  return (
    <div className="admin-kpi-section">
      <div className="admin-kpi-section-header">
        <h2 className="admin-kpi-section-title">
          {grupo.emoji} {grupo.titulo}
        </h2>
        {meta && <span className="admin-kpi-section-meta">{meta}</span>}
      </div>
      <div className="admin-kpi-grid">
        {grupo.kpis.map((k) => (
          <KPICard key={k.id} kpi={k} drillDownHref={drillDownHref} />
        ))}
      </div>
    </div>
  );
}
