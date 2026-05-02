// KPISelectorGrid — grid de selección con todos los KPIs agrupados por
// categoría. Click en uno → /admin/kpis?metric=<id>. Lote G.

import Link from "next/link";
import {
  obtenerKPIsPorCategoria,
  type KPIMeta,
} from "@/lib/services/kpis-metadata";
import { cn } from "@/lib/utils/cn";

export function KPISelectorGrid() {
  const grupos = obtenerKPIsPorCategoria();
  return (
    <div className="space-y-8">
      {grupos.map((g) => (
        <section key={g.id}>
          <h2 className="mb-3 text-admin-section text-dark">
            <span aria-hidden className="mr-2">
              {g.emoji}
            </span>
            {g.titulo}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {g.kpis.map((k) => (
              <KPISelectorTile key={k.id} kpi={k} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function KPISelectorTile({ kpi }: { kpi: KPIMeta }) {
  return (
    <Link
      href={`/admin/kpis?metric=${kpi.id}`}
      className={cn(
        "block rounded-md border border-admin-table-border bg-admin-card-bg p-4 transition-colors hover:border-strong",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-admin-card-title text-dark">{kpi.label}</div>
        {kpi.pendienteCableado && (
          <span
            className="rounded-sm bg-status-amber-bg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-status-amber-text"
            title="Métrica pendiente de cableado"
          >
            Pdte
          </span>
        )}
      </div>
      {kpi.targetLabel && (
        <div className="mt-2 text-admin-meta text-muted-d">
          Target: {kpi.targetLabel}
        </div>
      )}
      <div className="mt-2 text-admin-meta text-soft">
        Drill-down →
      </div>
    </Link>
  );
}
