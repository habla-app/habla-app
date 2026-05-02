// AccionesSugeridas — copy curado por status. Lote G.

import type { KPIMeta } from "@/lib/services/kpis-metadata";
import type { StatusKPI } from "@/lib/services/kpi-detalle.service";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { cn } from "@/lib/utils/cn";

interface Props {
  meta: KPIMeta;
  status: StatusKPI;
}

const HEADERS: Record<StatusKPI, { titulo: string; tone: string }> = {
  red: {
    titulo: "🔴 Status crítico",
    tone: "bg-status-red-bg text-status-red-text",
  },
  amber: {
    titulo: "🟡 Atención",
    tone: "bg-status-amber-bg text-status-amber-text",
  },
  good: {
    titulo: "🟢 OK",
    tone: "bg-status-green-bg text-status-green-text",
  },
  neutral: {
    titulo: "Sin datos",
    tone: "bg-admin-card-bg text-muted-d",
  },
};

export function AccionesSugeridas({ meta, status }: Props) {
  const head = HEADERS[status];
  return (
    <AdminCard
      title="Posibles causas y acciones recomendadas"
      bodyPadding="md"
    >
      <div className={cn("rounded-sm px-3 py-2 text-admin-card-title mb-4", head.tone)}>
        {head.titulo}
      </div>

      {status === "neutral" ? (
        <p className="text-admin-body text-muted-d">
          Aún no hay suficiente data para evaluar este KPI. Espera a que se acumulen
          mediciones o cablea la métrica si está pendiente.
        </p>
      ) : status === "good" ? (
        <p className="text-admin-body text-muted-d">
          Sigue así. Monitoreo regular y revisión de los breakdowns por dimensión
          si hay outliers.
        </p>
      ) : (
        <>
          {meta.causasComunes.length > 0 && (
            <section className="mb-4">
              <h3 className="text-admin-label text-muted-d mb-1.5">
                Posibles causas
              </h3>
              <ul className="space-y-1 text-admin-body text-dark">
                {meta.causasComunes.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 text-soft">
                      •
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {meta.accionesRecomendadas.length > 0 && (
            <section>
              <h3 className="text-admin-label text-muted-d mb-1.5">
                Acciones recomendadas
              </h3>
              <ol className="space-y-1.5 text-admin-body text-dark">
                {meta.accionesRecomendadas.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-blue-main text-[11px] font-bold text-white"
                    >
                      {i + 1}
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </AdminCard>
  );
}
