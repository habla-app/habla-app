// KPISeccion — agrupación de KPIs en grid 4 columnas. Lote F (May 2026).
// Spec: docs/ux-spec/05-pista-admin-operacion/dashboard.spec.md.
import type { KpisGrupo } from "@/lib/services/admin-kpis.service";
import { KPICard } from "./KPICard";

interface KPISeccionProps {
  grupo: KpisGrupo;
}

export function KPISeccion({ grupo }: KPISeccionProps) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-admin-section text-dark">
        <span aria-hidden className="mr-2">
          {grupo.emoji}
        </span>
        {grupo.titulo}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {grupo.kpis.map((k) => (
          <KPICard key={k.id} kpi={k} />
        ))}
      </div>
    </section>
  );
}
